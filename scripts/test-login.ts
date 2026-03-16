import 'dotenv/config'
import bcrypt from 'bcryptjs'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const email = 'manideeprao7@gmail.com'
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { console.log('No user found'); return }
    console.log('User found:', user.id, user.name)
    console.log('Has password:', !!user.password)
    console.log('Email verified:', user.emailVerified)
    
    // Simulate login logic
    if (user.password) {
      const valid = await bcrypt.compare('testpass', user.password)
      console.log('Password valid:', valid)
    }
    if (!user.emailVerified) {
      console.log('Would send verification email')
    }
    console.log('Login flow completed successfully')
  } catch(e: any) {
    console.error('ERROR:', e.message)
    console.error('Stack:', e.stack)
  } finally {
    await pool.end()
  }
}
main()
