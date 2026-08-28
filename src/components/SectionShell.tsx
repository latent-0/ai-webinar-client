import { useEffect, useState } from 'react'
import type { IASection } from '../lib/ia'
import { useActiveTab } from '../lib/nav'

/**
 * Section header + sub-navigation tabs (LLP-113).
 * Tabs are reflected in the URL as `?tab=` (so the command palette can deep-link)
 * while switching is handled with local state to stay type-safe against the
 * router's search schema.
 */
export default function SectionShell({
  section,
  defaultTab,
  children,
  actions,
}: {
  section: IASection
  defaultTab: string
  children: (tab: string) => React.ReactNode
  actions?: React.ReactNode
}) {
  const urlTab = useActiveTab(defaultTab)
  const [tab, setTab] = useState(urlTab)
  const Icon = section.icon

  // Keep local tab in sync when the URL changes (e.g. command-palette deep link).
  useEffect(() => { setTab(urlTab) }, [urlTab])

  function selectTab(id: string) {
    setTab(id)
    window.history.replaceState(null, '', `${section.path}?tab=${id}`)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
            <Icon size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{section.label}</h1>
            <p className="text-sm text-[var(--muted)]">{section.tagline}</p>
          </div>
        </div>
        {actions}
      </div>

      {section.tabs.length > 0 && (
        <div className="flex items-center gap-1 border-b border-[var(--border)] mb-6 overflow-x-auto no-scrollbar">
          {section.tabs.map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                onClick={() => selectTab(t.id)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  active
                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      )}

      {children(tab)}
    </div>
  )
}
