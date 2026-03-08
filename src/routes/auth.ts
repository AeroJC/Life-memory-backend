import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../db.js'

const router = Router()

async function processPendingInvites(userId: string, email: string) {
  const invites = await prisma.pendingInvite.findMany({ where: { email: email.toLowerCase() } })
  if (invites.length === 0) return
  for (const invite of invites) {
    const exists = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId, spaceId: invite.spaceId } } })
    if (!exists) {
      await prisma.spaceMember.create({
        data: { userId, spaceId: invite.spaceId, role: 'member', status: 'active', joinedAt: new Date().toISOString().split('T')[0] },
      })
    }
  }
  await prisma.pendingInvite.deleteMany({ where: { email: email.toLowerCase() } })
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body
  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: 'Name, email and password are required' }); return
  }
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' }); return
  }
  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      id: `u-${Date.now()}`,
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashed,
    },
  })
  await processPendingInvites(user.id, user.email)
  res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar }, token: user.id })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { id, email, phone, password } = req.body

  // Quick login by id (dev/test — no password check)
  if (id) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, phone: user.phone }, token: user.id })
    return
  }

  // Email + password login
  if (email) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' }); return
    }
    if (user.password) {
      const valid = await bcrypt.compare(password || '', user.password)
      if (!valid) {
        res.status(401).json({ error: 'Invalid email or password' }); return
      }
    }
    await processPendingInvites(user.id, user.email)
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, phone: user.phone }, token: user.id })
    return
  }

  // Phone login
  if (phone) {
    const user = await prisma.user.findFirst({ where: { phone } })
    if (!user) { res.status(401).json({ error: 'No account found with this phone number' }); return }
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, phone: user.phone }, token: user.id })
    return
  }

  res.status(400).json({ error: 'Email or phone required' })
})

// GET /api/auth/users
router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
  res.json(users)
})

export default router
