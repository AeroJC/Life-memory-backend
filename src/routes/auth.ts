import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../db.js'
import { Resend } from 'resend'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function codeExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
}

async function sendVerificationEmail(email: string, name: string, code: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  resend.emails.send({
    from: 'My Inner Circle <noreply@jagadeeshsura.in>',
    to: email,
    subject: 'Verify your email – My Inner Circle',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fffaf6;border-radius:16px;">
        <h2 style="font-family:Georgia,serif;color:#3d2c1e;margin-bottom:8px;">Welcome, ${name}! 🌸</h2>
        <p style="color:#6b5744;font-size:15px;line-height:1.6;">
          Enter this code to verify your email address:
        </p>
        <div style="background:#fff;border-radius:12px;padding:20px;margin:24px 0;text-align:center;border:1px solid #e8ddd6;">
          <p style="font-family:monospace;font-size:36px;letter-spacing:8px;color:#3d2c1e;margin:0;font-weight:bold;">${code}</p>
          <p style="color:#9b8579;font-size:12px;margin:8px 0 0;">Expires in 15 minutes</p>
        </div>
        <p style="color:#9b8579;font-size:13px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  }).catch((e) => console.error('Verification email failed:', e))
}

async function sendResetEmail(email: string, code: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  resend.emails.send({
    from: 'My Inner Circle <noreply@jagadeeshsura.in>',
    to: email,
    subject: 'Reset your password – My Inner Circle',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fffaf6;border-radius:16px;">
        <h2 style="font-family:Georgia,serif;color:#3d2c1e;margin-bottom:8px;">Password Reset 🔑</h2>
        <p style="color:#6b5744;font-size:15px;line-height:1.6;">
          Use this code to reset your password:
        </p>
        <div style="background:#fff;border-radius:12px;padding:20px;margin:24px 0;text-align:center;border:1px solid #e8ddd6;">
          <p style="font-family:monospace;font-size:36px;letter-spacing:8px;color:#3d2c1e;margin:0;font-weight:bold;">${code}</p>
          <p style="color:#9b8579;font-size:12px;margin:8px 0 0;">Expires in 15 minutes</p>
        </div>
        <p style="color:#9b8579;font-size:13px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  }).catch((e) => console.error('Reset email failed:', e))
}


// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body
  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: 'Name, email and password are required' }); return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    res.status(400).json({ error: 'Enter a valid email address (e.g. name@example.com)' }); return
  }
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' }); return
  }
  const hashed = await bcrypt.hash(password, 10)
  const code = generateCode()
  const user = await prisma.user.create({
    data: {
      id: `u-${Date.now()}`,
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashed,
      emailVerified: false,
      verificationCode: code,
      verificationCodeExpiry: codeExpiry(),
    },
  })
  await sendVerificationEmail(user.email, user.name, code)
  res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, emailVerified: false }, token: user.id })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { id, email, phone, password } = req.body

  // Quick login by id (session restore)
  if (id) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, phone: user.phone, emailVerified: user.emailVerified }, token: user.id })
    return
  }

  // Email + password login
  if (email) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user) {
      res.status(404).json({ error: 'No account found with this email. Sign up instead.', noAccount: true }); return
    }
    if (user.password) {
      const valid = await bcrypt.compare(password || '', user.password)
      if (!valid) {
        res.status(401).json({ error: 'Invalid email or password' }); return
      }
    }
    // If email not verified, send a fresh code and prompt verification
    if (!user.emailVerified) {
      const code = generateCode()
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationCode: code, verificationCodeExpiry: codeExpiry() },
      })
      await sendVerificationEmail(user.email, user.name, code)
      res.status(403).json({ error: 'Email not verified', emailNotVerified: true, userId: user.id, token: user.id })
      return
    }
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, phone: user.phone, emailVerified: true }, token: user.id })
    return
  }

  // Phone login
  if (phone) {
    const user = await prisma.user.findFirst({ where: { phone } })
    if (!user) { res.status(401).json({ error: 'No account found with this phone number' }); return }
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, phone: user.phone, emailVerified: user.emailVerified }, token: user.id })
    return
  }

  res.status(400).json({ error: 'Email or phone required' })
})

// POST /api/auth/send-verification
router.post('/send-verification', async (req, res) => {
  const { userId } = req.body
  if (!userId) { res.status(400).json({ error: 'userId is required' }); return }
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  if (user.emailVerified) { res.json({ success: true, message: 'Email already verified' }); return }
  const code = generateCode()
  await prisma.user.update({
    where: { id: userId },
    data: { verificationCode: code, verificationCodeExpiry: codeExpiry() },
  })
  await sendVerificationEmail(user.email, user.name, code)
  res.json({ success: true })
})

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  const { userId, code } = req.body
  if (!userId || !code) { res.status(400).json({ error: 'userId and code are required' }); return }
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  if (user.emailVerified) { res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, emailVerified: true }, token: user.id }); return }
  if (user.verificationCode !== code.trim()) {
    res.status(400).json({ error: 'Invalid verification code' }); return
  }
  if (user.verificationCodeExpiry && new Date() > user.verificationCodeExpiry) {
    res.status(400).json({ error: 'Verification code has expired. Please request a new one.' }); return
  }
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true, verificationCode: null, verificationCodeExpiry: null },
  })
  res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, emailVerified: true }, token: user.id })
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!email?.trim()) { res.status(400).json({ error: 'Email is required' }); return }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  // Always respond success to avoid email enumeration
  if (!user) { res.json({ success: true }); return }
  const code = generateCode()
  await prisma.user.update({
    where: { id: user.id },
    data: { resetCode: code, resetCodeExpiry: codeExpiry() },
  })
  await sendResetEmail(user.email, code)
  res.json({ success: true })
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body
  if (!email?.trim() || !code?.trim() || !newPassword) {
    res.status(400).json({ error: 'Email, code and new password are required' }); return
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' }); return
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || user.resetCode !== code.trim()) {
    res.status(400).json({ error: 'Invalid or expired reset code' }); return
  }
  if (user.resetCodeExpiry && new Date() > user.resetCodeExpiry) {
    res.status(400).json({ error: 'Reset code has expired. Please request a new one.' }); return
  }
  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetCode: null, resetCodeExpiry: null },
  })
  res.json({ success: true })
})

// POST /api/auth/change-password (requires auth)
router.post('/change-password', authMiddleware, async (req, res) => {
  const user = (req as any).user
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) { res.status(400).json({ error: 'Both passwords are required' }); return }
  if (newPassword.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters' }); return }
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser?.password) { res.status(400).json({ error: 'No password set' }); return }
  const valid = await bcrypt.compare(oldPassword, dbUser.password)
  if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return }
  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
  res.json({ success: true })
})

// GET /api/auth/users
router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
  res.json(users)
})

export default router
