import { Request, Response, NextFunction } from 'express'
import { prisma } from '../db.js'
import jwt from 'jsonwebtoken'

// Simple in-memory user cache with TTL
const userCache = new Map<string, { user: any; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCachedUser(userId: string) {
  const entry = userCache.get(userId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    userCache.delete(userId)
    return null
  }
  return entry.user
}

function setCachedUser(userId: string, user: any) {
  userCache.set(userId, { user, expiresAt: Date.now() + CACHE_TTL })
}

export function invalidateUserCache(userId: string) {
  userCache.delete(userId)
}

// Periodically clean expired entries (every 10 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of userCache) {
    if (now > entry.expiresAt) userCache.delete(key)
  }
}, 10 * 60 * 1000).unref()

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' })
    return
  }

  const token = header.replace('Bearer ', '')

  let payload: { userId: string }
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  // Check cache first
  let user = getCachedUser(payload.userId)
  if (!user) {
    user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    setCachedUser(payload.userId, user)
  }

  ;(req as any).user = user
  next()
}
