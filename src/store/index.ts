import { create } from 'zustand'

interface Room {
  id: string
  name: string
  participants: number
  createdAt: Date
  isActive: boolean
  // T-01 / T-16 extensions
  domain?: string          // e.g. 'dental', 'law', 'marketing'
  host?: string            // display name of the session host
  provider?: 'gemini' | 'claude'
  state: 'active' | 'ended'
  tokenUsage: number       // estimated tokens consumed this session
  tokenCeiling: number     // soft cap — default 50 000 ≈ £2.50 equivalent
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AppState {
  rooms: Room[]
  learnMessages: Message[]
  playMessages: Message[]
  liveAiMessages: Message[]
  displayName: string
  liveAiModel: string

  addRoom: (room: Room) => void
  removeRoom: (id: string) => void
  addLearnMessage: (msg: Message) => void
  addPlayMessage: (msg: Message) => void
  addLiveAiMessage: (msg: Message) => void
  setDisplayName: (name: string) => void
  setLiveAiModel: (model: string) => void
  /** Increment tokenUsage for a room by delta (T-16) */
  updateRoomTokens: (id: string, delta: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  rooms: [
    {
      id: 'webinar-ai-2025',
      name: 'AI in 2025: What You Need to Know',
      participants: 12,
      createdAt: new Date(),
      isActive: true,
      state: 'active',
      tokenUsage: 0,
      tokenCeiling: 50000,
    },
    {
      id: 'dental-practice-live',
      name: 'Modern Dental Practice Webinar',
      participants: 6,
      createdAt: new Date(Date.now() - 3600000),
      isActive: true,
      domain: 'dental',
      state: 'active',
      tokenUsage: 0,
      tokenCeiling: 50000,
    },
    {
      id: 'audit-workshop',
      name: 'Audit Workshop: Best Practices',
      participants: 0,
      createdAt: new Date(Date.now() - 86400000),
      isActive: false,
      state: 'ended',
      tokenUsage: 0,
      tokenCeiling: 50000,
    },
  ],
  learnMessages: [],
  playMessages: [],
  liveAiMessages: [],
  displayName: 'Guest',
  liveAiModel: 'gemini-2.5-flash',

  addRoom: (room: Room) => set((s: AppState) => ({ rooms: [room, ...s.rooms] })),
  removeRoom: (id: string) => set((s: AppState) => ({ rooms: s.rooms.filter((r: Room) => r.id !== id) })),
  addLearnMessage: (msg: Message) => set((s: AppState) => ({ learnMessages: [...s.learnMessages, msg] })),
  addPlayMessage: (msg: Message) => set((s: AppState) => ({ playMessages: [...s.playMessages, msg] })),
  addLiveAiMessage: (msg: Message) => set((s: AppState) => ({ liveAiMessages: [...s.liveAiMessages, msg] })),
  setDisplayName: (name: string) => set({ displayName: name }),
  setLiveAiModel: (model: string) => set({ liveAiModel: model }),
  updateRoomTokens: (id: string, delta: number) =>
    set((s: AppState) => ({
      rooms: s.rooms.map((r: Room) =>
        r.id === id ? { ...r, tokenUsage: r.tokenUsage + delta } : r,
      ),
    })),
}))

export type { Room, Message, AppState }
