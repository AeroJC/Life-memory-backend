import { Request, Response, NextFunction } from 'express'
import { prisma } from '../db.js'
import jwt from 'jsonwebtoken'

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

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) {
    res.status(401).json({ error: 'User not found' })
    return
  }

  ;(req as any).user = user
  next()
}
