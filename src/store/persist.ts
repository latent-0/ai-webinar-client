/**
 * Persistent system layer (LLP-114)
 *
 * The always-on store that backs every surface. Persisted to localStorage so a
 * user's role, preferences, library, projects, notes, AI memory and activity
 * follow them across Live, Learn, Play, Library, Projects, Analytics & Settings
 * — the "context persistence" information principle.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Types ────────────────────────────────────────────────────────────────────

export type Role = 'learner' | 'facilitator'
export type ContentKind = 'course' | 'lesson' | 'article' | 'document' | 'video' | 'playlist' | 'note' | 'scenario'
export type SurfaceOrigin = 'live' | 'learn' | 'play' | 'library' | 'projects'

export interface LibraryItem {
  id: string
  title: string
  kind: ContentKind
  origin: SurfaceOrigin
  topic?: string
  summary?: string
  bookmarked: boolean
  createdAt: number
}

export interface Note {
  id: string
  title: string
  body: string
  topic?: string
  aiGenerated: boolean
  createdAt: number
  updatedAt: number
}

export interface ProjectTask {
  id: string
  title: string
  done: boolean
}

export interface Project {
  id: string
  name: string
  description: string
  starred: boolean
  tasks: ProjectTask[]
  noteIds: string[]
  createdAt: number
  updatedAt: number
}

export interface ActivityEvent {
  id: string
  surface: SurfaceOrigin | 'settings' | 'analytics'
  label: string
  at: number
}

export interface AiMemory {
  /** Facts the assistant has learned about the user. */
  facts: string[]
  /** Freeform stated preferences. */
  preferences: string[]
  /** Corrections the user has issued. */
  corrections: string[]
}

export interface Settings {
  language: string
  aiModelPreference: string
  /** Privacy guardrail mirrored into the agent core. */
  allowClaude: boolean
  allowGemini: boolean
  notifications: {
    mentions: boolean
    sessionReminders: boolean
    productUpdates: boolean
  }
  reduceMotion: boolean
  /** Whether the AI may persist memory about the user. */
  aiMemoryEnabled: boolean
}

export interface Profile {
  name: string
  bio: string
}

// ── Defaults & seed ──────────────────────────────────────────────────────────

const now = 1_755_600_000_000 // fixed seed timestamp (avoids Date.now at import)

const SEED_LIBRARY: LibraryItem[] = [
  { id: 'seed-1', title: 'AI in 2025: What You Need to Know', kind: 'video', origin: 'live', topic: 'AI', summary: 'Recording of the flagship live session.', bookmarked: true, createdAt: now - 86_400_000 },
  { id: 'seed-2', title: 'Google Ads match types', kind: 'article', origin: 'learn', topic: 'Marketing', summary: 'Broad, phrase and exact match explained.', bookmarked: false, createdAt: now - 172_800_000 },
  { id: 'seed-3', title: 'Build an ad group (practice)', kind: 'scenario', origin: 'play', topic: 'Marketing', summary: 'Hands-on scenario from the Sandbox.', bookmarked: false, createdAt: now - 259_200_000 },
]

const SEED_PROJECTS: Project[] = [
  {
    id: 'proj-seed-1',
    name: 'Q4 Google Ads campaign',
    description: 'Plan and build a search campaign from the workshop.',
    starred: true,
    tasks: [
      { id: 't1', title: 'Draft match-type strategy', done: true },
      { id: 't2', title: 'Build ad group in Play', done: false },
      { id: 't3', title: 'Review with facilitator', done: false },
    ],
    noteIds: [],
    createdAt: now - 200_000_000,
    updatedAt: now - 100_000,
  },
]

const DEFAULT_SETTINGS: Settings = {
  language: 'en-US',
  aiModelPreference: 'claude-opus-4-8',
  allowClaude: true,
  allowGemini: true,
  notifications: { mentions: true, sessionReminders: true, productUpdates: false },
  reduceMotion: false,
  aiMemoryEnabled: true,
}

// ── Store ────────────────────────────────────────────────────────────────────

interface PersistState {
  role: Role
  profile: Profile
  settings: Settings
  library: LibraryItem[]
  notes: Note[]
  projects: Project[]
  aiMemory: AiMemory
  savedSearches: string[]
  activity: ActivityEvent[]

  setRole: (role: Role) => void
  setProfile: (patch: Partial<Profile>) => void
  setSettings: (patch: Partial<Settings>) => void

  addLibraryItem: (item: Omit<LibraryItem, 'id' | 'createdAt' | 'bookmarked'> & { bookmarked?: boolean }) => void
  removeLibraryItem: (id: string) => void
  toggleBookmark: (id: string) => void

  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'topic'>>) => void
  removeNote: (id: string) => void

  addProject: (name: string, description?: string) => string
  updateProject: (id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'starred'>>) => void
  removeProject: (id: string) => void
  addProjectTask: (projectId: string, title: string) => void
  toggleProjectTask: (projectId: string, taskId: string) => void

  addAiMemory: (bucket: keyof AiMemory, value: string) => void
  removeAiMemory: (bucket: keyof AiMemory, index: number) => void
  clearAiMemory: () => void

  addSavedSearch: (q: string) => void
  logActivity: (surface: ActivityEvent['surface'], label: string) => void

  /** Monotonic id counter — avoids Date.now()/Math.random() for ids. */
  _seq: number
}

/** Deterministic id generator (no Date.now/Math.random at module scope). */
function nextId(get: () => PersistState, set: (p: Partial<PersistState>) => void, prefix: string) {
  const seq = get()._seq + 1
  set({ _seq: seq })
  return `${prefix}-${seq}`
}

function stamp() {
  // Runtime timestamp is fine inside actions (only import-time is restricted).
  return Date.now()
}

export const usePersistStore = create<PersistState>()(
  persist(
    (set, get) => ({
      role: 'learner',
      profile: { name: 'Guest', bio: '' },
      settings: DEFAULT_SETTINGS,
      library: SEED_LIBRARY,
      notes: [],
      projects: SEED_PROJECTS,
      aiMemory: {
        facts: ['Attended the "AI in 2025" live session.'],
        preferences: ['Prefers concise, practical answers.'],
        corrections: [],
      },
      savedSearches: [],
      activity: [
        { id: 'act-seed', surface: 'live', label: 'Joined "AI in 2025"', at: now - 86_400_000 },
      ],
      _seq: 100,

      setRole: (role) => { set({ role }); get().logActivity('settings', `Switched role to ${role}`) },
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addLibraryItem: (item) =>
        set((s) => ({
          library: [
            { ...item, id: nextId(get, set, 'lib'), bookmarked: item.bookmarked ?? false, createdAt: stamp() },
            ...s.library,
          ],
        })),
      removeLibraryItem: (id) => set((s) => ({ library: s.library.filter((i) => i.id !== id) })),
      toggleBookmark: (id) =>
        set((s) => ({ library: s.library.map((i) => (i.id === id ? { ...i, bookmarked: !i.bookmarked } : i)) })),

      addNote: (note) => {
        const id = nextId(get, set, 'note')
        const t = stamp()
        set((s) => ({ notes: [{ ...note, id, createdAt: t, updatedAt: t }, ...s.notes] }))
        return id
      },
      updateNote: (id, patch) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: stamp() } : n)) })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      addProject: (name, description = '') => {
        const id = nextId(get, set, 'proj')
        const t = stamp()
        set((s) => ({
          projects: [
            { id, name, description, starred: false, tasks: [], noteIds: [], createdAt: t, updatedAt: t },
            ...s.projects,
          ],
        }))
        get().logActivity('projects', `Created project "${name}"`)
        return id
      },
      updateProject: (id, patch) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: stamp() } : p)) })),
      removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      addProjectTask: (projectId, title) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? { ...p, tasks: [...p.tasks, { id: nextId(get, set, 'task'), title, done: false }], updatedAt: stamp() }
              : p,
          ),
        })),
      toggleProjectTask: (projectId, taskId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)), updatedAt: stamp() }
              : p,
          ),
        })),

      addAiMemory: (bucket, value) =>
        set((s) => ({ aiMemory: { ...s.aiMemory, [bucket]: [...s.aiMemory[bucket], value] } })),
      removeAiMemory: (bucket, index) =>
        set((s) => ({ aiMemory: { ...s.aiMemory, [bucket]: s.aiMemory[bucket].filter((_, i) => i !== index) } })),
      clearAiMemory: () => set({ aiMemory: { facts: [], preferences: [], corrections: [] } }),

      addSavedSearch: (q) =>
        set((s) => (q.trim() && !s.savedSearches.includes(q.trim())
          ? { savedSearches: [q.trim(), ...s.savedSearches].slice(0, 20) }
          : {})),
      logActivity: (surface, label) =>
        set((s) => ({
          activity: [{ id: nextId(get, set, 'act'), surface, label, at: stamp() }, ...s.activity].slice(0, 100),
        })),
    }),
    {
      name: 'sandbox-persist-v1',
      partialize: (s) => ({
        role: s.role, profile: s.profile, settings: s.settings, library: s.library,
        notes: s.notes, projects: s.projects, aiMemory: s.aiMemory,
        savedSearches: s.savedSearches, activity: s.activity, _seq: s._seq,
      }),
    },
  ),
)

/** Map the user's settings to the agent-core privacy guardrail. */
export function allowedProvidersFromSettings(s: Settings): ('groq' | 'claude' | 'gemini')[] {
  // Groq is the primary TEXT provider; claude/gemini remain as configured
  // fallbacks so nothing breaks if a key is later added for them.
  const list: ('groq' | 'claude' | 'gemini')[] = ['groq']
  const claudePreferred = s.aiModelPreference.startsWith('claude')
  if (claudePreferred) {
    if (s.allowClaude) list.push('claude')
    if (s.allowGemini) list.push('gemini')
  } else {
    if (s.allowGemini) list.push('gemini')
    if (s.allowClaude) list.push('claude')
  }
  return list
}
