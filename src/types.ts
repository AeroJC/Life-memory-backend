export interface SubStory {
  id: string
  date: string
  type: 'text' | 'photo' | 'photos'
  title?: string
  content?: string
  photos?: string[]
  caption?: string
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
  joinedAt: string
}

export interface MemorySpace {
  id: string
  title: string
  coverImage: string
  coverEmoji: string
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
}
