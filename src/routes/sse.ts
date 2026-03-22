import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../db.js'
import { notificationBus } from '../notificationBus.js'

const router = Router()

// Track active connections per user (for debugging/metrics)
const activeConnections = new Map<string, Set<Response>>()

// Max concurrent SSE connections per user
const MAX_CONNECTIONS_PER_USER = 5

/**
 * GET /api/notifications/stream?token=<jwt>
 *
 * Server-Sent Events endpoint for real-time notifications.
 * Auth via query param because EventSource doesn't support custom headers.
 */
router.get('/stream', async (req: Request, res: Response) => {
  const token = req.query.token as string
  if (!token) {
    res.status(401).json({ error: 'Missing token parameter' })
    return
  }

  // Verify JWT
  let payload: { userId: string }
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  // Load user from DB
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) {
    res.status(401).json({ error: 'User not found' })
    return
  }

  // Check connection limit
  const userConns = activeConnections.get(user.id)
  if (userConns && userConns.size >= MAX_CONNECTIONS_PER_USER) {
    res.status(429).json({ error: 'Too many SSE connections' })
    return
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()

  // Send connected event
  res.write('event: connected\ndata: {"status":"ok"}\n\n')

  // Track this connection
  if (!activeConnections.has(user.id)) {
    activeConnections.set(user.id, new Set())
  }
  activeConnections.get(user.id)!.add(res)

  // Subscribe to notification bus
  const handler = (data: Record<string, unknown>) => {
    const id = (data.notification as Record<string, unknown>)?.id || Date.now().toString()
    res.write(`id: ${id}\nevent: notification\ndata: ${JSON.stringify(data)}\n\n`)
  }
  notificationBus.on(`notify:${user.id}`, handler)

  // Heartbeat every 30s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n')
  }, 30000)

  // Replay missed notifications if Last-Event-ID is present
  const lastEventId = req.headers['last-event-id'] as string | undefined
  if (lastEventId) {
    try {
      const missed = await prisma.notification.findMany({
        where: {
          userId: user.id,
          id: { gt: lastEventId },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: {
          actor: { select: { id: true, name: true, avatar: true } },
          space: { select: { id: true, title: true, coverEmoji: true, coverIcon: true } },
        },
      })
      for (const notif of missed) {
        res.write(`id: ${notif.id}\nevent: notification\ndata: ${JSON.stringify({ type: 'new_notification', notification: notif })}\n\n`)
      }
    } catch {
      // Non-critical — client will get future events regardless
    }
  }

  // Cleanup on disconnect
  req.on('close', () => {
    notificationBus.off(`notify:${user.id}`, handler)
    clearInterval(heartbeat)
    const conns = activeConnections.get(user.id)
    if (conns) {
      conns.delete(res)
      if (conns.size === 0) activeConnections.delete(user.id)
    }
  })
})

export default router
