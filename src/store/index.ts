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
  // No seeded/dummy rooms and no fake attendee counts (LLP-144 / LLP-145).
  // The lobby shows real sessions only — the ones a host actually starts.
  rooms: [],
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
