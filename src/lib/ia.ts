/**
 * Information Architecture config (LLP-113)
 *
 * Single source of truth for the 7-section IA from the design. Drives the
 * primary navigation, per-section sub-navigation (rendered as tabs via the
 * `?tab=` search param), and the global command palette / search index.
 */

import {
  Radio, BookOpen, Gamepad2, FolderOpen, Briefcase, BarChart2, Settings2,
  Home, type LucideIcon,
} from 'lucide-react'

export interface SubNavItem {
  id: string
  label: string
}

export interface IASection {
  id: string
  label: string
  tagline: string
  icon: LucideIcon
  /** Route path for the section index. */
  path: string
  /** Sub-navigation items, surfaced as ?tab= on the section page. */
  tabs: SubNavItem[]
  /** Sections only shown to facilitators. */
  facilitatorOnly?: boolean
}

export const HOME_SECTION: IASection = {
  id: 'home', label: 'Home', tagline: 'Your dashboard', icon: Home, path: '/home', tabs: [],
}

export const SECTIONS: IASection[] = [
  {
    id: 'live', label: 'Live', tagline: 'Interactive experiences', icon: Radio, path: '/live',
    tabs: [
      { id: 'upcoming', label: 'Upcoming' },
      { id: 'live-now', label: 'Live Now' },
      { id: 'past', label: 'Past Events' },
      { id: 'calendar', label: 'Calendar' },
    ],
  },
  {
    id: 'learn', label: 'Learn', tagline: 'Knowledge hub', icon: BookOpen, path: '/learn',
    tabs: [
      { id: 'hub', label: 'Knowledge Hub' },
      { id: 'my-learning', label: 'My Learning' },
      { id: 'search', label: 'Smart Search' },
      { id: 'assistant', label: 'AI Assistant' },
    ],
  },
  {
    id: 'play', label: 'Play', tagline: 'Playground & practice', icon: Gamepad2, path: '/play',
    tabs: [
      { id: 'home', label: 'Play Home' },
      { id: 'modes', label: 'Play Modes' },
      { id: 'scenarios', label: 'Scenarios' },
      { id: 'feedback', label: 'Validation & Feedback' },
    ],
  },
  {
    id: 'library', label: 'Library', tagline: 'My content & history', icon: FolderOpen, path: '/library',
    tabs: [
      { id: 'all', label: 'All Content' },
      { id: 'saved', label: 'Saved & Bookmarks' },
      { id: 'notes', label: 'Notes' },
      { id: 'history', label: 'History' },
      { id: 'sources', label: 'Sources' },
      { id: 'memory', label: 'My AI Memory' },
    ],
  },
  {
    id: 'projects', label: 'Projects', tagline: 'My work & collections', icon: Briefcase, path: '/projects',
    tabs: [
      { id: 'all', label: 'All Projects' },
      { id: 'starred', label: 'Starred' },
      { id: 'templates', label: 'Templates' },
    ],
  },
  {
    id: 'analytics', label: 'Analytics', tagline: 'Progress & insights', icon: BarChart2, path: '/analytics',
    tabs: [
      { id: 'insights', label: 'My Insights' },
      { id: 'live', label: 'Live Analytics' },
      { id: 'play', label: 'Play Analytics' },
      { id: 'team', label: 'Team / Org' },
    ],
  },
  {
    id: 'settings', label: 'Settings', tagline: 'Account & preferences', icon: Settings2, path: '/settings',
    tabs: [
      { id: 'profile', label: 'Profile' },
      { id: 'preferences', label: 'Preferences' },
      { id: 'integrations', label: 'Integrations' },
      { id: 'ai', label: 'AI Settings' },
      { id: 'admin', label: 'Admin' },
    ],
  },
]

/** All sections including Home, in nav order. */
export const ALL_SECTIONS: IASection[] = [HOME_SECTION, ...SECTIONS]

export function sectionById(id: string): IASection | undefined {
  return ALL_SECTIONS.find((s) => s.id === id)
}

/** Static command-palette / search entries derived from the IA tree. */
export interface SearchEntry {
  label: string
  sublabel: string
  path: string
}

export const IA_SEARCH_INDEX: SearchEntry[] = ALL_SECTIONS.flatMap((s) => [
  { label: s.label, sublabel: s.tagline, path: s.path },
  ...s.tabs.map((t) => ({
    label: `${s.label} · ${t.label}`,
    sublabel: s.tagline,
    path: `${s.path}?tab=${t.id}`,
  })),
])
