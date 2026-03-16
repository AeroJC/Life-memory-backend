import { Router } from 'express'
import { prisma, formatMemory } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { User } from '../types.js'
import { deleteCloudinaryImages, getRemovedUrls } from '../cloudinary.js'

const router = Router()
router.use(authMiddleware)

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
    textStyle: s.textStyle ? JSON.parse(s.textStyle as string) : undefined,
    titleStyle: s.titleStyle ? JSON.parse(s.titleStyle as string) : undefined,
  })))
})

// POST /api/spaces/:spaceId/memories
router.post('/:spaceId/memories', async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateEditPermission(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'You have view-only access to this space' }); return
  }

  const { title, date, story, location, tags, photos, endDate, visibleTo } = req.body
  if (!title?.trim() || !story?.trim()) {
    res.status(400).json({ error: 'Title and story are required' }); return
  }

  // Validate photo URLs
  if (photos && Array.isArray(photos)) {
    const maxPhotos = 20
    if (photos.length > maxPhotos) {
      res.status(400).json({ error: `Maximum ${maxPhotos} photos per memory` }); return
    }
    for (const url of photos) {
      if (typeof url !== 'string' || url.length > 500) {
        res.status(400).json({ error: 'Invalid photo URL' }); return
      }
    }
  }

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

  res.status(201).json(formatMemory(memory))
})

// PUT /api/spaces/:spaceId/memories/:memoryId
router.put('/:spaceId/memories/:memoryId', async (req, res) => {
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
router.delete('/:spaceId/memories/:memoryId', async (req, res) => {
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
  res.json({ success: true })
})

// POST /api/spaces/:spaceId/memories/:memoryId/react
router.post('/:spaceId/memories/:memoryId/react', async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateMembership(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'Not a member of this space' }); return
  }

  const { emoji } = req.body
  if (!emoji) { res.status(400).json({ error: 'Emoji is required' }); return }

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
router.post('/:spaceId/memories/:memoryId/substories', async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateEditPermission(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'You have view-only access to this space' }); return
  }

  const { date, type, title, content, caption, photos, textStyle, titleStyle } = req.body

  const substory = await prisma.subStory.create({
    data: {
      id: `sub-${Date.now()}`,
      date: date || new Date().toISOString().split('T')[0],
      type: type || 'text',
      title: title?.trim() || null,
      content: type === 'text' ? content?.trim() : null,
      caption: type !== 'text' ? caption?.trim() : null,
      photos: type !== 'text' ? JSON.stringify(photos || []) : undefined,
      textStyle: textStyle ? JSON.stringify(textStyle) : null,
      titleStyle: titleStyle ? JSON.stringify(titleStyle) : null,
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
    textStyle: substory.textStyle ? JSON.parse(substory.textStyle as string) : undefined,
    titleStyle: substory.titleStyle ? JSON.parse(substory.titleStyle as string) : undefined,
  })
})

// PUT /api/spaces/:spaceId/memories/:memoryId/substories/:substoryId
router.put('/:spaceId/memories/:memoryId/substories/:substoryId', async (req, res) => {
  const user = (req as any).user as User
  if (!(await validateEditPermission(req.params.spaceId, user.id))) {
    res.status(403).json({ error: 'You have view-only access to this space' }); return
  }

  const { type, title, content, caption, photos, textStyle, titleStyle } = req.body
  const data: any = {}
  if (type !== undefined) data.type = type
  if (title !== undefined) data.title = title?.trim() || null
  if (textStyle !== undefined) data.textStyle = textStyle ? JSON.stringify(textStyle) : null
  if (titleStyle !== undefined) data.titleStyle = titleStyle ? JSON.stringify(titleStyle) : null
  if (type === 'text') {
    if (content !== undefined) data.content = content?.trim() || null
    data.caption = null; data.photos = null
  } else if (type !== undefined) {
    if (caption !== undefined) data.caption = caption?.trim() || null
    data.content = null
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
    textStyle: substory.textStyle ? JSON.parse(substory.textStyle as string) : undefined,
    titleStyle: substory.titleStyle ? JSON.parse(substory.titleStyle as string) : undefined,
  })
})

// DELETE /api/spaces/:spaceId/memories/:memoryId/substories/:substoryId
router.delete('/:spaceId/memories/:memoryId/substories/:substoryId', async (req, res) => {
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
