import 'dotenv/config'
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { prisma } from './db.js'
import authRoutes from './routes/auth.js'
import spaceRoutes from './routes/spaces.js'
import memoryRoutes from './routes/memories.js'

const app = express()
const PORT = process.env.PORT || 3001

// Prevent process crashes from unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server kept alive):', err.message)
})
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (server kept alive):', reason)
})

const allowedOrigins = [
  'http://localhost:5173',
  'capacitor://localhost',   // iOS Capacitor WebView
  'http://localhost',        // Android Capacitor WebView
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(o => o.trim()) : []),
]
// CORS must come before helmet so preflight requests are handled correctly
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true)
    else callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(express.json({ limit: '2mb' }))

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many verification attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})
const actionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/auth/login', loginLimiter)
app.use('/api/auth/pre-signup', loginLimiter)
app.use('/api/auth/complete-signup', loginLimiter)
app.use('/api/auth/forgot-password', loginLimiter)
app.use('/api/auth/verify-email', verifyLimiter)
app.use('/api/spaces/:id/invite', actionLimiter)
app.use('/api/spaces/:spaceId/memories/:memoryId/react', actionLimiter)

// Wrap all async route handlers to catch unhandled rejections
function wrapRouter(router: any) {
  const methods = ['get', 'post', 'put', 'patch', 'delete'] as const
  for (const layer of router.stack || []) {
    if (layer.route) {
      for (const routeLayer of layer.route.stack) {
        const original = routeLayer.handle
        if (original.length <= 3) { // not error handler
          routeLayer.handle = (req: Request, res: Response, next: NextFunction) => {
            const result = original(req, res, next)
            if (result && typeof result.catch === 'function') {
              result.catch((err: Error) => {
                console.error(`Route error [${req.method} ${req.originalUrl}]:`, err.message)
                if (!res.headersSent) {
                  res.status(500).json({ error: 'Internal server error' })
                }
              })
            }
          }
        }
      }
    }
  }
  return router
}

// Routes
app.use('/api/auth', wrapRouter(authRoutes))
app.use('/api/spaces', wrapRouter(spaceRoutes))
app.use('/api/spaces', wrapRouter(memoryRoutes))

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() })
  } catch {
    res.json({ status: 'ok', db: 'disconnected', timestamp: new Date().toISOString() })
  }
})

// Global error handler — must be last middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log('Database: PostgreSQL (Neon)')
})
