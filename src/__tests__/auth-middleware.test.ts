import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { authMiddleware, invalidateUserCache } from '../middleware/auth.js'
import { prisma } from '../db.js'
import { Request, Response, NextFunction } from 'express'

const JWT_SECRET = process.env.JWT_SECRET!

function createMocks(authHeader?: string) {
  const req = {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as Request
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response
  const next = vi.fn() as NextFunction
  return { req, res, next }
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear user cache between tests
    invalidateUserCache('user-1')
  })

  it('rejects requests without authorization header', async () => {
    const { req, res, next } = createMocks()
    await authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing authorization header' })
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects requests with non-Bearer token', async () => {
    const { req, res, next } = createMocks('Basic abc123')
    await authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing authorization header' })
  })

  it('rejects invalid JWT tokens', async () => {
    const { req, res, next } = createMocks('Bearer invalid-token')
    await authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' })
  })

  it('rejects valid token for non-existent user', async () => {
    const token = jwt.sign({ userId: 'user-nonexistent' }, JWT_SECRET)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const { req, res, next } = createMocks(`Bearer ${token}`)
    await authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' })
  })

  it('attaches user to request for valid token', async () => {
    const mockUser = { id: 'user-1', name: 'Alice', email: 'alice@test.com' }
    const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    const { req, res, next } = createMocks(`Bearer ${token}`)
    await authMiddleware(req, res, next)
    expect(next).toHaveBeenCalled()
    expect((req as any).user).toEqual(mockUser)
  })

  it('uses cached user on second call', async () => {
    const mockUser = { id: 'user-1', name: 'Alice', email: 'alice@test.com' }
    const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    // First call - should hit DB
    const call1 = createMocks(`Bearer ${token}`)
    await authMiddleware(call1.req, call1.res, call1.next)
    expect(prisma.user.findUnique).toHaveBeenCalledOnce()

    // Second call - should use cache
    const call2 = createMocks(`Bearer ${token}`)
    await authMiddleware(call2.req, call2.res, call2.next)
    expect(prisma.user.findUnique).toHaveBeenCalledOnce() // Still 1 call
    expect(call2.next).toHaveBeenCalled()
  })

  it('invalidateUserCache forces DB lookup', async () => {
    const mockUser = { id: 'user-1', name: 'Alice', email: 'alice@test.com' }
    const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    // First call - populates cache
    const call1 = createMocks(`Bearer ${token}`)
    await authMiddleware(call1.req, call1.res, call1.next)

    // Invalidate cache
    invalidateUserCache('user-1')

    // Second call - should hit DB again
    const call2 = createMocks(`Bearer ${token}`)
    await authMiddleware(call2.req, call2.res, call2.next)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2)
  })
})
