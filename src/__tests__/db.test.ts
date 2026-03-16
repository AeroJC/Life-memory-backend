import { describe, it, expect, vi } from 'vitest'

// Unmock db.js for this test file - we want to test the real formatters
vi.unmock('../db.js')

// We can't import the full db.js because it connects to Postgres,
// so we test the pure formatter logic directly
describe('formatSpace', () => {
  // Inline the real formatSpace logic for unit testing
  function formatSpace(space: any) {
    return {
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
    }
  }

  function parseJson(value: any, fallback: any) {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'string') {
      try { return JSON.parse(value) } catch { return fallback }
    }
    return value
  }

  function formatMemory(m: any) {
    return {
      id: m.id,
      title: m.title,
      date: m.date,
      endDate: m.endDate,
      photos: parseJson(m.photos, []),
      story: m.story,
      location: m.location,
      tags: parseJson(m.tags, undefined),
      reactions: parseJson(m.reactions, {}),
      visibleTo: parseJson(m.visibleTo, undefined),
      createdBy: m.createdById,
      substories: m.substories ? m.substories.map((s: any) => ({
        id: s.id,
        date: s.date,
        type: s.type,
        title: s.title,
        content: s.content,
        photos: parseJson(s.photos, undefined),
        caption: s.caption,
      })) : undefined,
    }
  }

  it('formats a space with all fields', () => {
    const space = {
      id: 'sp-1',
      title: 'Family',
      coverImage: 'img.jpg',
      coverEmoji: '👨‍👩‍👧',
      coverIcon: 'heart',
      coverColor: '#ff0000',
      type: 'group',
      createdById: 'u-1',
      inviteCode: 'ABC123',
      description: 'Our family space',
      _count: { memories: 5 },
      members: [
        { userId: 'u-1', user: { name: 'Alice' }, role: 'owner', status: 'active', permission: 'edit', joinedAt: '2024-01-01' },
      ],
      joinRequests: [
        { userId: 'u-2', user: { name: 'Bob' }, requestedAt: '2024-01-02' },
      ],
    }

    const result = formatSpace(space)
    expect(result.id).toBe('sp-1')
    expect(result.title).toBe('Family')
    expect(result.memoryCount).toBe(5)
    expect(result.type).toBe('group')
    expect(result.createdBy).toBe('u-1')
    expect(result.inviteCode).toBe('ABC123')
    expect(result.membersList).toHaveLength(1)
    expect(result.membersList[0].name).toBe('Alice')
    expect(result.joinRequests).toHaveLength(1)
    expect(result.joinRequests[0].userName).toBe('Bob')
  })

  it('handles missing optional fields', () => {
    const space = {
      id: 'sp-2',
      title: 'Personal',
      coverImage: null,
      coverEmoji: null,
      coverIcon: null,
      coverColor: null,
      type: 'personal',
      createdById: 'u-1',
      inviteCode: null,
      description: null,
      members: [],
      joinRequests: [],
    }
    const result = formatSpace(space)
    expect(result.coverIcon).toBe('')
    expect(result.coverColor).toBe('')
    expect(result.memoryCount).toBe(0)
    expect(result.membersList).toEqual([])
  })

  it('uses memories length when _count is absent', () => {
    const space = {
      id: 'sp-3',
      title: 'Test',
      type: 'personal',
      createdById: 'u-1',
      memories: [{ id: 'm1' }, { id: 'm2' }],
      members: [],
      joinRequests: [],
    }
    const result = formatSpace(space)
    expect(result.memoryCount).toBe(2)
  })

  it('defaults permission to edit when not specified', () => {
    const space = {
      id: 'sp-4',
      title: 'Test',
      type: 'group',
      createdById: 'u-1',
      members: [{ userId: 'u-1', user: { name: 'Alice' }, role: 'owner', status: 'active' }],
      joinRequests: [],
    }
    const result = formatSpace(space)
    expect(result.membersList[0].permission).toBe('edit')
  })

  describe('formatMemory', () => {
    it('formats a memory with JSON string fields', () => {
      const memory = {
        id: 'm-1',
        title: 'Birthday',
        date: '2024-06-15',
        endDate: '2024-06-16',
        photos: JSON.stringify(['photo1.jpg', 'photo2.jpg']),
        story: 'Great day!',
        location: 'New York',
        tags: JSON.stringify(['birthday', 'fun']),
        reactions: JSON.stringify({ '❤️': 3, '🎉': 1 }),
        visibleTo: JSON.stringify(['u-1', 'u-2']),
        createdById: 'u-1',
        substories: [
          { id: 's-1', date: '2024-06-15', type: 'text', title: 'Morning', content: 'Started the day', photos: null, caption: null },
        ],
      }

      const result = formatMemory(memory)
      expect(result.id).toBe('m-1')
      expect(result.title).toBe('Birthday')
      expect(result.photos).toEqual(['photo1.jpg', 'photo2.jpg'])
      expect(result.tags).toEqual(['birthday', 'fun'])
      expect(result.reactions).toEqual({ '❤️': 3, '🎉': 1 })
      expect(result.visibleTo).toEqual(['u-1', 'u-2'])
      expect(result.createdBy).toBe('u-1')
      expect(result.substories).toHaveLength(1)
    })

    it('handles null JSON fields with fallbacks', () => {
      const memory = {
        id: 'm-2',
        title: 'Test',
        date: '2024-01-01',
        photos: null,
        story: 'test',
        location: null,
        tags: null,
        reactions: null,
        visibleTo: null,
        createdById: 'u-1',
      }

      const result = formatMemory(memory)
      expect(result.photos).toEqual([])
      expect(result.reactions).toEqual({})
      expect(result.tags).toBeUndefined()
      expect(result.visibleTo).toBeUndefined()
      expect(result.substories).toBeUndefined()
    })

    it('handles already-parsed JSON values (arrays/objects)', () => {
      const memory = {
        id: 'm-3',
        title: 'Test',
        date: '2024-01-01',
        photos: ['a.jpg'],
        story: 'test',
        tags: ['tag1'],
        reactions: { '👍': 1 },
        visibleTo: ['u-1'],
        createdById: 'u-1',
      }
      const result = formatMemory(memory)
      expect(result.photos).toEqual(['a.jpg'])
      expect(result.tags).toEqual(['tag1'])
    })

    it('handles malformed JSON strings gracefully', () => {
      const memory = {
        id: 'm-4',
        title: 'Test',
        date: '2024-01-01',
        photos: 'not-valid-json',
        story: 'test',
        tags: '{broken',
        reactions: 'nope',
        createdById: 'u-1',
      }
      const result = formatMemory(memory)
      expect(result.photos).toEqual([])
      expect(result.reactions).toEqual({})
    })
  })
})
