import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma, formatMemory } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { User } from '../types.js'
import { deleteCloudinaryImages, getRemovedUrls } from '../cloudinary.js'
import { invalidateSpaceCache } from './spaces.js'

const router = Router()
router.use(authMiddleware)

// Rate limit write operations (create, update, delete)
const memoryWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

async function validateMembership(spaceId: string, userId: string) {
  const member = await prisma.spaceMember.findUnique({
    where: { userId_spaceId: { userId, spaceId } },
  })
  if (!member || member.status !== 'active') return false
  return true
}

async function validateEditPermission(spaceId: string, userId: string) {
  const member = await prisma.spaceMember.findUnique({
    where: { userId_spaceId: { userId, spaceId } },
  })
  if (!member || member.status !== 'active') return false
  // owner always has edit access; others need permission === 'edit'
  if (member.role === 'owner') return true
  return (member.permission ?? 'edit') === 'edit'
}

const createMemorySchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  date: z.string().optional(),
  story: z.string().trim().min(1, 'Story is required'),
  location: z.string().optional(),
  tags: z.array(z.string()).optional(),
  photos: z.array(z.string().max(500, 'Invalid photo URL')).max(20, 'Maximum 20 photos per memory').optional(),
  endDate: z.string().optional(),
  visibleTo: z.array(z.string()).optional(),
})

const updateMemorySchema = z.object({
  title: z.string().trim().optional(),
  date: z.string().optional(),
  story: z.string().trim().optional(),
  location: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  photos: z.array(z.string()).optional(),
  endDate: z.string().optional(),
  visibleTo: z.array(z.string()).nullable().optional(),
})

const reactSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required'),
})

const createSubstorySchema = z.object({
  date: z.string().optional(),
  type: z.enum(['text', 'photo', 'photos', 'img-left', 'img-right', 'img-top', 'img-bottom', 'canvas']).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  caption: z.string().optional(),
  photos: z.array(z.string()).optional(),
  textStyle: z.record(z.string(), z.unknown()).optional(),
  titleStyle: z.record(z.string(), z.unknown()).optional(),
  canvasData: z.record(z.string(), z.unknown()).optional(),
})

const updateSubstorySchema = z.object({
  type: z.enum(['text', 'photo', 'photos', 'img-left', 'img-right', 'img-top', 'img-bottom', 'canvas']).optional(),
  title: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  photos: z.array(z.string()).optional(),
  textStyle: z.record(z.string(), z.unknown()).nullable().optional(),
  titleStyle: z.record(z.string(), z.unknown()).nullable().optional(),
  canvasData: z.record(z.string(), z.unknown()).nullable().optional(),
})

// GET /api/spaces/:spaceId/memories/:memoryId/substories
router.get('/:spaceId/memories/:memoryId/substories', async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateMembership(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'Not a member of this space' }); return
  }
  const substories = await prisma.subStory.findMany({ where: { memoryId: req.params.memoryId } })
  res.json(substories.map((s) => ({
    id: s.id, date: s.date, type: s.type, title: s.title, content: s.content,
    photos: s.photos ? JSON.parse(s.photos as string) : undefined, caption: s.caption,
    textStyle: s.textStyle ? (typeof s.textStyle === 'string' ? JSON.parse(s.textStyle) : s.textStyle) : undefined,
    titleStyle: s.titleStyle ? (typeof s.titleStyle === 'string' ? JSON.parse(s.titleStyle as string) : s.titleStyle) : undefined,
    canvasData: s.canvasData ? (typeof s.canvasData === 'string' ? JSON.parse(s.canvasData as string) : s.canvasData) : undefined,
  })))
})

// POST /api/spaces/:spaceId/memories
router.post('/:spaceId/memories', memoryWriteLimiter, validate(createMemorySchema), async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateEditPermission(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'You have view-only access to this space' }); return
  }

  const { title, date, story, location, tags, photos, endDate, visibleTo } = req.body

  const memory = await prisma.memory.create({
    data: {
      id: `m-${Date.now()}`,
      title: title.trim(),
      date,
      endDate,
      photos: JSON.stringify(photos || []),
      story: story.trim(),
      location: location?.trim() || null,
      tags: tags ? JSON.stringify(tags) : undefined,
      reactions: JSON.stringify({}),
      visibleTo: visibleTo?.length > 0 ? JSON.stringify(visibleTo) : undefined,
      createdById: user.id,
      spaceId: req.params.spaceId,
    },
    include: { substories: true },
  })
  invalidateSpaceCache(undefined, req.params.spaceId)

  res.status(201).json(formatMemory(memory))
})

// PUT /api/spaces/:spaceId/memories/:memoryId
router.put('/:spaceId/memories/:memoryId', memoryWriteLimiter, validate(updateMemorySchema), async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateEditPermission(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'You have view-only access to this space' }); return
  }

  // Only the creator or an owner/admin can edit a memory
  const existingForAuth = await prisma.memory.findUnique({ where: { id: req.params.memoryId }, select: { createdById: true } })
  if (existingForAuth && existingForAuth.createdById !== user.id) {
    const myMember = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: req.params.spaceId } } })
    if (myMember?.role !== 'owner' && myMember?.role !== 'admin') {
      res.status(403).json({ error: 'You can only edit your own memories' }); return
    }
  }

  const { title, date, story, location, tags, photos, endDate, visibleTo } = req.body
  const data: any = {}
  if (title !== undefined) data.title = title.trim()
  if (date !== undefined) data.date = date
  if (endDate !== undefined) data.endDate = endDate
  if (story !== undefined) data.story = story.trim()
  if (location !== undefined) data.location = location?.trim() || null
  if (tags !== undefined) data.tags = tags ? JSON.stringify(tags) : null
  if (photos !== undefined) data.photos = JSON.stringify(photos || [])
  if (visibleTo !== undefined) data.visibleTo = visibleTo?.length > 0 ? JSON.stringify(visibleTo) : null

  // Delete removed photos from Cloudinary
  if (photos !== undefined) {
    const existing = await prisma.memory.findUnique({ where: { id: req.params.memoryId } })
    if (existing) {
      const oldPhotos: string[] = typeof existing.photos === 'string' ? JSON.parse(existing.photos) : (existing.photos as any) || []
      const removed = getRemovedUrls(oldPhotos, photos || [])
      if (removed.length > 0) deleteCloudinaryImages(removed).catch(() => {})
    }
  }

  const memory = await prisma.memory.update({
    where: { id: req.params.memoryId },
    data,
    include: { substories: true },
  })

  res.json(formatMemory(memory))
})

// DELETE /api/spaces/:spaceId/memories/:memoryId
router.delete('/:spaceId/memories/:memoryId', memoryWriteLimiter, async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateEditPermission(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'You have view-only access to this space' }); return
  }

  // Only the creator or an owner/admin can delete a memory
  const memForAuth = await prisma.memory.findUnique({ where: { id: req.params.memoryId }, select: { createdById: true } })
  if (memForAuth && memForAuth.createdById !== user.id) {
    const myMember = await prisma.spaceMember.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: req.params.spaceId } } })
    if (myMember?.role !== 'owner' && myMember?.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own memories' }); return
    }
  }

  // Collect all photos before deleting
  const memory = await prisma.memory.findUnique({
    where: { id: req.params.memoryId },
    include: { substories: true },
  })
  if (memory) {
    const allUrls: string[] = []
    const memPhotos: string[] = typeof memory.photos === 'string' ? JSON.parse(memory.photos) : (memory.photos as any) || []
    allUrls.push(...memPhotos)
    for (const sub of memory.substories) {
      if (sub.photos) {
        const subPhotos: string[] = typeof sub.photos === 'string' ? JSON.parse(sub.photos) : (sub.photos as any) || []
        allUrls.push(...subPhotos)
      }
    }
    if (allUrls.length > 0) deleteCloudinaryImages(allUrls).catch(() => {})
  }

  await prisma.memory.delete({ where: { id: req.params.memoryId } })
  invalidateSpaceCache(undefined, req.params.spaceId)
  res.json({ success: true })
})

// POST /api/spaces/:spaceId/memories/:memoryId/react
router.post('/:spaceId/memories/:memoryId/react', validate(reactSchema), async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateMembership(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'Not a member of this space' }); return
  }

  const { emoji } = req.body

  // Use a transaction with row-level lock to prevent race conditions
  const updated = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ reactions: string }>>`
      SELECT reactions FROM "Memory" WHERE id = ${req.params.memoryId} FOR UPDATE
    `
    if (!rows[0]) return null
    const reactions: Record<string, number> = (() => {
      try { return JSON.parse(rows[0].reactions as string) } catch { return {} }
    })()
    reactions[emoji] = (reactions[emoji] || 0) + 1
    return tx.memory.update({
      where: { id: req.params.memoryId },
      data: { reactions: JSON.stringify(reactions) },
      select: { reactions: true },
    })
  })

  if (!updated) { res.status(404).json({ error: 'Memory not found' }); return }
  const reactions = typeof updated.reactions === 'string' ? JSON.parse(updated.reactions) : updated.reactions
  res.json({ reactions })
})

// POST /api/spaces/:spaceId/memories/:memoryId/substories
router.post('/:spaceId/memories/:memoryId/substories', memoryWriteLimiter, validate(createSubstorySchema), async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateEditPermission(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'You have view-only access to this space' }); return
  }

  const { date, type, title, content, caption, photos, textStyle, titleStyle, canvasData } = req.body

  const substory = await prisma.subStory.create({
    data: {
      id: `sub-${Date.now()}`,
      date: date || new Date().toISOString().split('T')[0],
      type: type || 'text',
      title: title?.trim() || null,
      content: type === 'text' ? content?.trim() : null,
      caption: type !== 'text' && type !== 'canvas' ? caption?.trim() : null,
      photos: type !== 'text' && type !== 'canvas' ? JSON.stringify(photos || []) : undefined,
      textStyle: textStyle ? JSON.stringify(textStyle) : undefined,
      titleStyle: titleStyle ? JSON.stringify(titleStyle) : undefined,
      canvasData: type === 'canvas' && canvasData ? JSON.stringify(canvasData) : undefined,
      memoryId: req.params.memoryId,
    },
  })

  res.status(201).json({
    id: substory.id,
    date: substory.date,
    type: substory.type,
    title: substory.title,
    content: substory.content,
    photos: substory.photos ? JSON.parse(substory.photos as string) : undefined,
    caption: substory.caption,
    textStyle: substory.textStyle ? (typeof substory.textStyle === 'string' ? JSON.parse(substory.textStyle) : substory.textStyle) : undefined,
    titleStyle: substory.titleStyle ? (typeof substory.titleStyle === 'string' ? JSON.parse(substory.titleStyle as string) : substory.titleStyle) : undefined,
    canvasData: substory.canvasData ? (typeof substory.canvasData === 'string' ? JSON.parse(substory.canvasData as string) : substory.canvasData) : undefined,
  })
})

// PUT /api/spaces/:spaceId/memories/:memoryId/substories/:substoryId
router.put('/:spaceId/memories/:memoryId/substories/:substoryId', memoryWriteLimiter, validate(updateSubstorySchema), async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateEditPermission(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'You have view-only access to this space' }); return
  }

  const { type, title, content, caption, photos, textStyle, titleStyle, canvasData } = req.body
  const data: any = {}
  if (type !== undefined) data.type = type
  if (title !== undefined) data.title = title?.trim() || null
  if (textStyle !== undefined) data.textStyle = textStyle ? JSON.stringify(textStyle) : null
  if (titleStyle !== undefined) data.titleStyle = titleStyle ? JSON.stringify(titleStyle) : null
  if (canvasData !== undefined) data.canvasData = canvasData ? JSON.stringify(canvasData) : null
  if (type === 'canvas') {
    data.content = null; data.caption = null; data.photos = null
  } else if (type === 'text') {
    if (content !== undefined) data.content = content?.trim() || null
    data.caption = null; data.photos = null; data.canvasData = null
  } else if (type !== undefined) {
    if (caption !== undefined) data.caption = caption?.trim() || null
    data.content = null; data.canvasData = null
    if (photos !== undefined) data.photos = JSON.stringify(photos || [])
  } else {
    if (content !== undefined) data.content = content?.trim() || null
    if (caption !== undefined) data.caption = caption?.trim() || null
    if (photos !== undefined) data.photos = JSON.stringify(photos || [])
  }

  // Delete removed photos from Cloudinary
  if (photos !== undefined) {
    const existing = await prisma.subStory.findUnique({ where: { id: req.params.substoryId } })
    if (existing?.photos) {
      const oldPhotos: string[] = typeof existing.photos === 'string' ? JSON.parse(existing.photos) : (existing.photos as any) || []
      const removed = getRemovedUrls(oldPhotos, photos || [])
      if (removed.length > 0) deleteCloudinaryImages(removed).catch(() => {})
    }
  }

  const substory = await prisma.subStory.update({ where: { id: req.params.substoryId }, data })
  res.json({
    id: substory.id, date: substory.date, type: substory.type,
    title: substory.title, content: substory.content,
    photos: substory.photos ? JSON.parse(substory.photos as string) : undefined,
    caption: substory.caption,
    textStyle: substory.textStyle ? (typeof substory.textStyle === 'string' ? JSON.parse(substory.textStyle) : substory.textStyle) : undefined,
    titleStyle: substory.titleStyle ? (typeof substory.titleStyle === 'string' ? JSON.parse(substory.titleStyle as string) : substory.titleStyle) : undefined,
    canvasData: substory.canvasData ? (typeof substory.canvasData === 'string' ? JSON.parse(substory.canvasData as string) : substory.canvasData) : undefined,
  })
})

// DELETE /api/spaces/:spaceId/memories/:memoryId/substories/:substoryId
router.delete('/:spaceId/memories/:memoryId/substories/:substoryId', memoryWriteLimiter, async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateEditPermission(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'You have view-only access to this space' }); return
  }
  const substory = await prisma.subStory.findUnique({ where: { id: req.params.substoryId } })
  if (substory?.photos) {
    const photos: string[] = typeof substory.photos === 'string' ? JSON.parse(substory.photos) : (substory.photos as any) || []
    if (photos.length > 0) deleteCloudinaryImages(photos).catch(() => {})
  }

  await prisma.subStory.delete({ where: { id: req.params.substoryId } })
  res.json({ success: true })
})

export default router
