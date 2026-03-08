import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { allUsers, spaces } from '../src/data.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Clear existing data
  await prisma.subStory.deleteMany()
  await prisma.memory.deleteMany()
  await prisma.joinRequest.deleteMany()
  await prisma.spaceMember.deleteMany()
  await prisma.space.deleteMany()
  await prisma.user.deleteMany()

  // Create users
  for (const u of allUsers) {
    await prisma.user.create({
      data: { id: u.id, name: u.name, email: u.email, phone: u.phone, avatar: u.avatar },
    })
  }
  console.log(`Created ${allUsers.length} users`)

  // Create spaces with members, memories, substories
  for (const s of spaces) {
    await prisma.space.create({
      data: {
        id: s.id,
        title: s.title,
        coverImage: s.coverImage,
        coverEmoji: s.coverEmoji,
        type: s.type,
        inviteCode: s.inviteCode,
        description: s.description || '',
        createdById: s.createdBy,
      },
    })

    // Create members
    for (const m of s.membersList) {
      await prisma.spaceMember.create({
        data: {
          userId: m.userId,
          spaceId: s.id,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
        },
      })
    }

    // Create memories
    for (const mem of s.memories) {
      await prisma.memory.create({
        data: {
          id: mem.id,
          title: mem.title,
          date: mem.date,
          endDate: mem.endDate,
          photos: JSON.stringify(mem.photos),
          story: mem.story,
          location: mem.location,
          tags: mem.tags ? JSON.stringify(mem.tags) : undefined,
          reactions: JSON.stringify(mem.reactions || {}),
          visibleTo: mem.visibleTo ? JSON.stringify(mem.visibleTo) : undefined,
          createdById: mem.createdBy,
          spaceId: s.id,
        },
      })

      // Create substories
      if (mem.substories) {
        for (const sub of mem.substories) {
          await prisma.subStory.create({
            data: {
              id: sub.id,
              date: sub.date,
              type: sub.type,
              title: sub.title,
              content: sub.content,
              photos: sub.photos ? JSON.stringify(sub.photos) : undefined,
              caption: sub.caption,
              memoryId: mem.id,
            },
          })
        }
      }
    }

    console.log(`Created space: ${s.title} (${s.memories.length} memories, ${s.membersList.length} members)`)
  }

  console.log('Seeding complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
