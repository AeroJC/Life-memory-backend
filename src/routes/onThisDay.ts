import { Router } from 'express'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { User } from '../types.js'

const router = Router()
router.use(authMiddleware)

// GET /api/on-this-day — Returns memories from previous years on today's month/day
router.get('/', async (req, res) => {
  const user = (req as any).user as User

  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const currentYear = now.getFullYear()
  const monthDay = `-${month}-${day}`

  // Get all spaces user is a member of
  const memberships = await prisma.spaceMember.findMany({
    where: { userId: user.id, status: 'active' },
    select: { spaceId: true },
  })
  const spaceIds = memberships.map((m) => m.spaceId)
  if (spaceIds.length === 0) {
    res.json([])
    return
  }

  // Find memories whose date ends with -MM-DD (same month/day, different year)
  const memories = await prisma.memory.findMany({
    where: {
      spaceId: { in: spaceIds },
      date: { endsWith: monthDay },
    },
    include: {
      space: { select: { id: true, title: true } },
    },
    orderBy: { date: 'asc' },
  })

  // Filter out memories from this year (we only want past years)
  const result = memories
    .filter((m) => {
      const memYear = parseInt(m.date.split('-')[0], 10)
      return memYear < currentYear
    })
    .filter((m) => {
      // Respect visibleTo — if set, must include current user or be creator
      const visibleTo = m.visibleTo
        ? typeof m.visibleTo === 'string' ? JSON.parse(m.visibleTo) : m.visibleTo
        : null
      if (!visibleTo || (visibleTo as string[]).length === 0) return true
      if (m.createdById === user.id) return true
      return (visibleTo as string[]).includes(user.id)
    })
    .map((m) => {
      const memYear = parseInt(m.date.split('-')[0], 10)
      const photos: string[] = typeof m.photos === 'string' ? JSON.parse(m.photos) : (m.photos as string[]) || []
      return {
        id: m.id,
        title: m.title,
        date: m.date,
        photos,
        story: m.story,
        location: m.location,
        spaceId: m.space.id,
        spaceTitle: m.space.title,
        yearsAgo: currentYear - memYear,
      }
    })

  res.json(result)
})

export default router
