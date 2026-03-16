import { vi } from 'vitest'

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-for-testing'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NODE_ENV = 'test'

// Mock Prisma client
vi.mock('../db.js', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    space: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    spaceMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    joinRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    pendingInvite: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    memory: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    subStory: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  }

  return {
    prisma: mockPrisma,
    formatSpace: vi.fn((space: any) => ({
      id: space.id,
      title: space.title,
      coverImage: space.coverImage,
      coverEmoji: space.coverEmoji,
      coverIcon: space.coverIcon || '',
      coverColor: space.coverColor || '',
      memoryCount: space._count?.memories ?? space.memories?.length ?? 0,
      type: space.type,
      createdBy: space.createdById,
      inviteCode: space.inviteCode,
      description: space.description,
      membersList: (space.members || []).map((m: any) => ({
        userId: m.userId,
        name: m.user?.name || m.name || '',
        role: m.role,
        status: m.status,
        permission: m.permission ?? 'edit',
        joinedAt: m.joinedAt,
      })),
      joinRequests: (space.joinRequests || []).map((r: any) => ({
        userId: r.userId,
        userName: r.user?.name || '',
        requestedAt: r.requestedAt,
      })),
    })),
    formatMemory: vi.fn((m: any) => ({
      id: m.id,
      title: m.title,
      date: m.date,
      endDate: m.endDate,
      photos: m.photos || [],
      story: m.story,
      location: m.location,
      tags: m.tags,
      reactions: m.reactions || {},
      visibleTo: m.visibleTo,
      createdBy: m.createdById,
      substories: m.substories,
    })),
    formatSpaceWithMemories: vi.fn(),
  }
})

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
  })),
}))

// Mock cloudinary
vi.mock('../cloudinary.js', () => ({
  deleteImages: vi.fn().mockResolvedValue(undefined),
}))
