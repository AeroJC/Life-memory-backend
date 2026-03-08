import { Request, Response, NextFunction } from 'express'
import { prisma } from '../db.js'

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' })
    return
  }

  const userId = header.replace('Bearer ', '')
  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (!user) {
    res.status(401).json({ error: 'Invalid user' })
    return
  }

  ;(req as any).user = user
  next()
}
