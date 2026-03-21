import { Router } from 'express'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { User } from '../types.js'

const router = Router()
router.use(authMiddleware)

// GET /api/notifications — get user's notifications
router.get('/', async (req, res) => {
  const user = (req as any).user as User
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      actor: { select: { id: true, name: true, avatar: true } },
      space: { select: { id: true, title: true, coverEmoji: true, coverIcon: true } },
    },
  })
  res.json(notifications)
})

// GET /api/notifications/unread-count — get unread counts grouped by space
router.get('/unread-count', async (req, res) => {
  const user = (req as any).user as User
  const counts = await prisma.notification.groupBy({
    by: ['spaceId'],
    where: { userId: user.id, read: false },
    _count: { id: true },
  })
  const total = counts.reduce((sum, c) => sum + c._count.id, 0)
  res.json({
    total,
    bySpace: Object.fromEntries(counts.map(c => [c.spaceId, c._count.id])),
  })
})

// GET /api/notifications/summary — consolidated notification data for polling
router.get('/summary', async (req, res) => {
  const user = (req as any).user as User

  // Get spaces the user owns to filter join requests
  const ownedSpaces = await prisma.space.findMany({
    where: { createdById: user.id },
    select: { id: true },
  })
  const ownedSpaceIds = ownedSpaces.map(s => s.id)

  const [countRows, inviteRows, joinReqRows, recentNotifs] = await Promise.all([
    // Unread counts by space
    prisma.notification.groupBy({
      by: ['spaceId'],
      where: { userId: user.id, read: false },
      _count: { id: true },
    }),
    // Pending invites for this user
    prisma.pendingInvite.findMany({
      where: { email: user.email, status: 'pending' },
      include: { space: { select: { title: true, coverEmoji: true, coverIcon: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    // Join requests on spaces the user owns
    ownedSpaceIds.length > 0
      ? prisma.joinRequest.findMany({
          where: { spaceId: { in: ownedSpaceIds } },
          include: { user: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    // Recent unread notifications
    prisma.notification.findMany({
      where: { userId: user.id, read: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        actor: { select: { id: true, name: true, avatar: true } },
        space: { select: { id: true, title: true, coverEmoji: true, coverIcon: true } },
      },
    }),
  ])

  const total = countRows.reduce((sum, c) => sum + c._count.id, 0)

  // Resolve inviter names
  const invitedByIds = [...new Set(inviteRows.map((i) => i.invitedBy))]
  const inviters = invitedByIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: invitedByIds } }, select: { id: true, name: true } })
    : []
  const inviterMap = Object.fromEntries(inviters.map((u) => [u.id, u.name]))

  res.json({
    unreadCounts: {
      total,
      bySpace: Object.fromEntries(countRows.map(c => [c.spaceId, c._count.id])),
    },
    pendingInvites: inviteRows.map((i) => ({
      id: i.id,
      spaceId: i.spaceId,
      spaceName: i.space.title,
      spaceEmoji: i.space.coverEmoji,
      spaceIcon: i.space.coverIcon || undefined,
      invitedBy: inviterMap[i.invitedBy] || 'Someone',
      status: i.status,
      createdAt: i.createdAt,
    })),
    joinRequests: joinReqRows.map((r: any) => ({
      userId: r.userId,
      userName: r.user?.name || '',
      spaceId: r.spaceId,
      requestedAt: r.requestedAt,
    })),
    notifications: recentNotifs,
  })
})

// POST /api/notifications/mark-read — mark notifications as read
router.post('/mark-read', async (req, res) => {
  const user = (req as any).user as User
  const { notificationIds, spaceId } = req.body

  if (spaceId) {
    // Mark all notifications for a space as read
    await prisma.notification.updateMany({
      where: { userId: user.id, spaceId, read: false },
      data: { read: true },
    })
  } else if (notificationIds?.length) {
    // Mark specific notifications as read
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, userId: user.id },
      data: { read: true },
    })
  } else {
    // Mark all as read
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    })
  }
  res.json({ success: true })
})

export default router

// Helper: create notifications for all space members except the actor
export async function notifySpaceMembers(
  spaceId: string,
  actorId: string,
  type: string,
  message: string,
  targetId?: string
) {
  const members = await prisma.spaceMember.findMany({
    where: { spaceId, status: 'active', userId: { not: actorId } },
    select: { userId: true },
  })

  if (members.length === 0) return

  await prisma.notification.createMany({
    data: members.map(m => ({
      type,
      message,
      spaceId,
      actorId,
      targetId: targetId || null,
      userId: m.userId,
    })),
  })
}
