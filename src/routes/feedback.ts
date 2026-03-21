import { Router } from 'express'
import { z } from 'zod'
import { Resend } from 'resend'
import { authMiddleware } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { prisma } from '../db.js'

const router = Router()

const feedbackSchema = z.object({
  type: z.enum(['suggestion', 'bug', 'complaint']),
  message: z.string().min(1, 'Message is required').max(2000, 'Message is too long'),
})

async function sendFeedbackEmail(
  feedbackType: string,
  message: string,
  userName: string,
  userEmail: string,
) {
  const FEEDBACK_EMAIL = 'jagadeesh.sura22@gmail.com'
  const timestamp = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
  const typeLabel = feedbackType.charAt(0).toUpperCase() + feedbackType.slice(1)
  const typeColor = feedbackType === 'bug' ? '#e8927c' : feedbackType === 'complaint' ? '#d97706' : '#d4a574'

  const html = `
    <div style="font-family: 'Georgia', serif; max-width: 520px; margin: 0 auto; background: #fffbf5; border-radius: 16px; overflow: hidden; border: 1px solid #f0e6d8;">
      <div style="background: linear-gradient(135deg, #d4a574, #e8927c); padding: 24px 32px;">
        <h1 style="margin: 0; color: #fff; font-size: 20px; font-weight: 600;">New Feedback</h1>
        <p style="margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">My Inner Circle</p>
      </div>
      <div style="padding: 28px 32px;">
        <div style="display: inline-block; background: ${typeColor}20; color: ${typeColor}; padding: 4px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 20px;">
          ${typeLabel}
        </div>
        <div style="background: #fff; border: 1px solid #f0e6d8; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0; color: #4a3728; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
        </div>
        <div style="border-top: 1px solid #f0e6d8; padding-top: 16px; font-size: 13px; color: #8b7355;">
          <p style="margin: 0 0 4px;"><strong>From:</strong> ${userName} (${userEmail})</p>
          <p style="margin: 0;"><strong>Sent:</strong> ${timestamp}</p>
        </div>
      </div>
    </div>
  `

  if (!process.env.RESEND_API_KEY) {
    console.log(`[dev] Feedback from ${userEmail}: [${feedbackType}] ${message}`)
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'My Inner Circle <noreply@jagadeeshsura.in>',
    to: FEEDBACK_EMAIL,
    subject: `[${typeLabel}] Feedback from ${userName}`,
    html,
  })
}

// POST /api/feedback
router.post('/', authMiddleware, validate(feedbackSchema), async (req, res) => {
  const { type, message } = req.body
  const user = (req as any).user

  await prisma.feedback.create({
    data: {
      type,
      message,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    },
  })

  await sendFeedbackEmail(type, message, user.name, user.email)

  res.json({ success: true })
})

export default router
