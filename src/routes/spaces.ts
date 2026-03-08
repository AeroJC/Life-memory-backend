import { Router } from 'express'
import { prisma, formatSpace, formatSpaceWithMemories } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { User } from '../types.js'

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
async function generateInviteCode(): Promise<string> {
  const existing = await prisma.space.findMany({ where: { inviteCode: { not: null } }, select: { inviteCode: true } })
  const codes = new Set(existing.map((s) => s.inviteCode))
  let code = ''
  do {
    code = ''
    for (let i = 0; i < 6; i++) code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)]
  } while (codes.has(code))
  return code
}

const spaceIncludes = {
  members: { include: { user: { select: { name: true } } } },
  joinRequests: { include: { user: { select: { name: true } } } },
  _count: { select: { memories: true } },
}

const router = Router()
router.use(authMiddleware)

// GET /api/spaces
router.get('/', async (req, res) => {
  const user = (req as any).user as User
  const spaces = await prisma.space.findMany({
    where: { members: { some: { userId: user.id, status: 'active' } } },
    include: spaceIncludes,
  })
  res.json(spaces.map(formatSpace))
})

// GET /api/spaces/:id
router.get('/:id', async (req, res) => {
  const user = (req as any).user as User
  const space = await prisma.space.findUnique({
    where: { id: req.params.id },
    include: {
      ...spaceIncludes,
      memories: { include: { substories: true } },
    },
  })
  if (!space) { res.status(404).json({ error: 'Space not found' }); return }

  const isMember = space.members.some((m) => m.userId === user.id && m.status === 'active')
  if (!isMember) { res.status(403).json({ error: 'Not a member of this space' }); return }

  const formatted = formatSpaceWithMemories(space)
  // Filter by visibleTo
  formatted.memories = formatted.memories.filter((m: any) => {
    if (!m.visibleTo || m.visibleTo.length === 0) return true
    return m.visibleTo.includes(user.id)
  })
  res.json(formatted)
})

// POST /api/spaces
router.post('/', async (req, res) => {
  const user = (req as any).user as User
  const { title, coverEmoji, type, description } = req.body
  if (!title?.trim()) { res.status(400).json({ error: 'Title is required' }); return }

  const inviteCode = type === 'group' ? await generateInviteCode() : undefined
  const space = await prisma.space.create({
    data: {
      id: `space-${Date.now()}`,
      title: title.trim(),
      coverEmoji: coverEmoji || '✨',
      type: type || 'personal',
      inviteCode,
      description: description || '',
      createdById: user.id,
      members: {
        create: { userId: user.id, role: 'owner', status: 'active', joinedAt: new Date().toISOString().split('T')[0] },
      },
    },
    include: spaceIncludes,
  })
  res.status(201).json(formatSpace(space))
})

// POST /api/spaces/join
router.post('/join', async (req, res) => {
  const user = (req as any).user as User
  const { code } = req.body
  if (!code?.trim()) { res.status(400).json({ error: 'Invite code is required' }); return }

  const space = await prisma.space.findUnique({
    where: { inviteCode: code.toUpperCase().trim() },
    include: { members: true, joinRequests: true },
  })
  if (!space) { res.status(404).json({ error: 'Invalid invite code. Please check and try again.' }); return }
  if (space.members.some((m) => m.userId === user.id && m.status === 'active')) {
    res.status(409).json({ error: 'You are already a member of this space.' }); return
  }
  if (space.joinRequests.some((r) => r.userId === user.id)) {
    res.status(409).json({ error: 'You already have a pending request for this space.' }); return
  }

  await prisma.joinRequest.create({
    data: { userId: user.id, spaceId: space.id, requestedAt: new Date().toISOString().split('T')[0] },
  })
  res.json({ success: true, spaceName: space.title })
})

// POST /api/spaces/:id/approve
router.post('/:id/approve', async (req, res) => {
  const user = (req as any).user as User
  const { userId } = req.body

  const myMember = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: req.params.id } } })
  if (!myMember || (myMember.role !== 'owner' && myMember.role !== 'admin')) {
    res.status(403).json({ error: 'Only owner or admin can approve requests' }); return
  }

  const request = await prisma.joinRequest.findUnique({ where: { userId_spaceId: { userId, spaceId: req.params.id } } })
  if (!request) { res.status(404).json({ error: 'Request not found' }); return }

  const requestUser = await prisma.user.findUnique({ where: { id: userId } })

  await prisma.$transaction([
    prisma.spaceMember.create({
      data: { userId, spaceId: req.params.id, role: 'member', status: 'active', joinedAt: new Date().toISOString().split('T')[0] },
    }),
    prisma.joinRequest.delete({ where: { userId_spaceId: { userId, spaceId: req.params.id } } }),
  ])

  res.json({ success: true, member: { userId, name: requestUser?.name, role: 'member', status: 'active' } })
})

// POST /api/spaces/:id/reject
router.post('/:id/reject', async (req, res) => {
  const user = (req as any).user as User
  const { userId } = req.body

  const myMember = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: req.params.id } } })
  if (!myMember || (myMember.role !== 'owner' && myMember.role !== 'admin')) {
    res.status(403).json({ error: 'Only owner or admin can reject requests' }); return
  }

  await prisma.joinRequest.deleteMany({ where: { userId, spaceId: req.params.id } })
  res.json({ success: true })
})

// POST /api/spaces/:id/invite
router.post('/:id/invite', async (req, res) => {
  const user = (req as any).user as User
  const { email } = req.body

  if (!email?.trim() || !email.includes('@')) {
    res.status(400).json({ error: 'Valid email is required' }); return
  }

  const myMember = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: req.params.id } } })
  if (!myMember || (myMember.role !== 'owner' && myMember.role !== 'admin')) {
    res.status(403).json({ error: 'Only owner or admin can invite members' }); return
  }

  const normalizedEmail = email.toLowerCase().trim()

  // If user already exists, add them directly
  const invitedUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (invitedUser) {
    const existing = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId: invitedUser.id, spaceId: req.params.id } } })
    if (existing?.status === 'active') {
      res.status(409).json({ error: 'This user is already a member' }); return
    }
    await prisma.spaceMember.upsert({
      where: { userId_spaceId: { userId: invitedUser.id, spaceId: req.params.id } },
      create: { userId: invitedUser.id, spaceId: req.params.id, role: 'member', status: 'active', joinedAt: new Date().toISOString().split('T')[0] },
      update: { status: 'active' },
    })
    res.json({ success: true, message: `${invitedUser.name} has been added to the space` })
    return
  }

  // Store pending invite — auto-joins when they sign up
  await prisma.pendingInvite.upsert({
    where: { email_spaceId: { email: normalizedEmail, spaceId: req.params.id } },
    create: { email: normalizedEmail, spaceId: req.params.id, invitedBy: user.id },
    update: { invitedBy: user.id },
  })
  res.json({ success: true, message: `Invite sent to ${email}. They'll join automatically when they sign up.` })
})

// PATCH /api/spaces/:id
router.patch('/:id', async (req, res) => {
  const user = (req as any).user as User
  const myMember = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: req.params.id } } })
  if (!myMember || myMember.role !== 'owner') { res.status(403).json({ error: 'Only the owner can edit this space' }); return }

  const { title, coverEmoji, description } = req.body
  const data: any = {}
  if (title !== undefined) data.title = title.trim()
  if (coverEmoji !== undefined) data.coverEmoji = coverEmoji
  if (description !== undefined) data.description = description

  const space = await prisma.space.update({ where: { id: req.params.id }, data, include: spaceIncludes })
  res.json(formatSpace(space))
})

// DELETE /api/spaces/:id
router.delete('/:id', async (req, res) => {
  const user = (req as any).user as User
  const myMember = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: req.params.id } } })
  if (!myMember || myMember.role !== 'owner') { res.status(403).json({ error: 'Only the owner can delete this space' }); return }

  await prisma.space.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// DELETE /api/spaces/:id/members/:userId
router.delete('/:id/members/:userId', async (req, res) => {
  const user = (req as any).user as User
  const myMember = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: req.params.id } } })
  if (!myMember || (myMember.role !== 'owner' && myMember.role !== 'admin')) {
    res.status(403).json({ error: 'Only owner or admin can remove members' }); return
  }

  await prisma.spaceMember.deleteMany({ where: { userId: req.params.userId, spaceId: req.params.id } })
  res.json({ success: true })
})

// PATCH /api/spaces/:id/members/:userId
router.patch('/:id/members/:userId', async (req, res) => {
  const user = (req as any).user as User
  const myMember = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: req.params.id } } })
  if (!myMember || myMember.role !== 'owner') {
    res.status(403).json({ error: 'Only owner can change roles' }); return
  }

  const { role } = req.body
  const updated = await prisma.spaceMember.update({
    where: { userId_spaceId: { userId: req.params.userId, spaceId: req.params.id } },
    data: { role },
  })
  res.json({ success: true, member: updated })
})

export default router
