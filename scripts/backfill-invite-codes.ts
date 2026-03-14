/**
 * Backfill invite codes for existing group spaces that don't have one.
 *
 * Usage:
 *   cd "MemoryWall-Claude backend"
 *   npx tsx scripts/backfill-invite-codes.ts
 */

import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

async function generateInviteCode(): Promise<string> {
  let code = ''
  do {
    code = ''
    for (let i = 0; i < 8; i++) code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)]
  } while (await prisma.space.findFirst({ where: { inviteCode: code } }))
  return code
}

async function main() {
  const groupSpaces = await prisma.space.findMany({
    where: {
      type: 'group',
      OR: [
        { inviteCode: null },
        { inviteCode: '' },
      ],
    },
    select: { id: true, title: true },
  })

  if (groupSpaces.length === 0) {
    console.log('All group spaces already have invite codes. Nothing to do.')
    return
  }

  console.log(`Found ${groupSpaces.length} group space(s) without invite codes:\n`)

  for (const space of groupSpaces) {
    const code = await generateInviteCode()
    await prisma.space.update({
      where: { id: space.id },
      data: { inviteCode: code },
    })
    console.log(`  "${space.title}" (${space.id}) → ${code}`)
  }

  console.log(`\nDone. ${groupSpaces.length} invite code(s) generated.`)
}

main()
  .catch((err) => {
    console.error('Failed:', err)
    process.exit(1)
  })
  .finally(() => pool.end())
