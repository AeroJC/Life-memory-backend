import express from 'express'
import cors from 'cors'
import { prisma } from './db.js'
import authRoutes from './routes/auth.js'
import spaceRoutes from './routes/spaces.js'
import memoryRoutes from './routes/memories.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/spaces', spaceRoutes)
app.use('/api/spaces', memoryRoutes)

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() })
  } catch {
    res.json({ status: 'ok', db: 'disconnected', timestamp: new Date().toISOString() })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log('Database: PostgreSQL (Neon)')
})
