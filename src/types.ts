export interface SubStory {
  id: string
  date: string
  type: 'text' | 'photo' | 'photos' | 'img-left' | 'img-right' | 'img-top' | 'img-bottom' | 'canvas' | 'video'
  title?: string
  content?: string
  photos?: string[]
  caption?: string
  textStyle?: Record<string, unknown>
  titleStyle?: Record<string, unknown>
  canvasData?: Record<string, unknown>
  audioUrl?: string
  videoUrl?: string
}

export interface Memory {
  id: string
  title: string
  date: string
  endDate?: string
  photos: string[]
  story: string
  location?: string
  tags?: string[]
  reactions?: Record<string, number>
  substories?: SubStory[]
  visibleTo?: string[]
  createdBy?: string
}

export interface JoinRequest {
  userId: string
  userName: string
  requestedAt: string
}

export interface SpaceMember {
  userId: string
  name: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'pending'
  permission?: 'view' | 'edit'
  joinedAt: string
}

export interface MemorySpace {
  id: string
  title: string
  coverImage: string
  coverImageOffsetX?: number
  coverImageOffsetY?: number
  coverImageScale?: number
  coverEmoji: string
  coverIcon?: string
  coverColor?: string
  memoryCount: number
  type: 'personal' | 'group'
  createdBy: string
  inviteCode?: string
  membersList: SpaceMember[]
  joinRequests: JoinRequest[]
  description?: string
  memories: Memory[]
}

export interface User {
  id: string
  name: string
  avatar: string
  email: string
  phone?: string
  hasVaultCode?: boolean
  hiddenSpaceIds?: string[]
}
