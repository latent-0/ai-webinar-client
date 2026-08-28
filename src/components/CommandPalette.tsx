import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, CornerDownLeft, Sparkles, FileText, FolderOpen, Briefcase, Loader2 } from 'lucide-react'
import { IA_SEARCH_INDEX } from '../lib/ia'
import { usePersistStore, allowedProvidersFromSettings } from '../store/persist'
import { runAgent } from '../lib/agents'

/**
 * Global command palette + search (LLP-122).
 * Ctrl/Cmd+K opens it. Searches the IA tree, library, projects and notes, and
 * offers an "Ask AI" action that answers via the unified agent core.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const library = usePersistStore((s) => s.library)
  const projects = usePersistStore((s) => s.projects)
  const notes = usePersistStore((s) => s.notes)
  const settings = usePersistStore((s) => s.settings)
  const addSavedSearch = usePersistStore((s) => s.addSavedSearch)

  // Global hotkey
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    function onOpen() { setOpen(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('sandbox:open-command', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('sandbox:open-command', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20)
    else { setQ(''); setAiAnswer(null) }
  }, [open])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return { nav: IA_SEARCH_INDEX.slice(0, 6), content: [] as ContentHit[] }
    const nav = IA_SEARCH_INDEX.filter(
      (e) => e.label.toLowerCase().includes(query) || e.sublabel.toLowerCase().includes(query),
    ).slice(0, 6)
    const content: ContentHit[] = [
      ...library.filter((i) => i.title.toLowerCase().includes(query)).map((i) => ({
        icon: FolderOpen, label: i.title, sub: `Library · ${i.kind}`, path: '/library?tab=all',
      })),
      ...projects.filter((p) => p.name.toLowerCase().includes(query)).map((p) => ({
        icon: Briefcase, label: p.name, sub: 'Project', path: `/projects?tab=all`,
      })),
      ...notes.filter((n) => n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query)).map((n) => ({
        icon: FileText, label: n.title || 'Untitled note', sub: 'Note', path: '/library?tab=notes',
      })),
    ].slice(0, 6)
    return { nav, content }
  }, [q, library, projects, notes])

  function go(path: string) {
    setOpen(false)
    const [pathname, query] = path.split('?')
    navigate({ to: pathname })
    // Preserve the sub-tab for deep links without fighting the typed search schema.
    if (query) window.history.replaceState(null, '', path)
  }

  async function askAI() {
    if (!q.trim() || aiLoading) return
    setAiLoading(true)
    setAiAnswer(null)
    addSavedSearch(q.trim())
    try {
      const { answer } = await runAgent('assistant', q.trim(), {
        allowedProviders: allowedProvidersFromSettings(settings),
        overrideModelId: settings.aiModelPreference,
      })
      setAiAnswer(answer)
    } catch {
      setAiAnswer('The AI assistant is unavailable right now.')
    } finally {
      setAiLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-[var(--border)]">
          <Search size={16} className="text-[var(--muted)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') askAI() }}
            placeholder="Search Sandbox or ask AI…"
            className="flex-1 bg-transparent py-3.5 text-sm focus:outline-none text-[var(--text)]"
          />
          <kbd className="text-[10px] text-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {q.trim() && (
            <button
              onClick={askAI}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--surface-3)] text-left"
            >
              <Sparkles size={15} className="text-indigo-500 shrink-0" />
              <span className="text-sm flex-1">Ask AI: <span className="text-[var(--muted)]">“{q.trim()}”</span></span>
              {aiLoading ? <Loader2 size={14} className="animate-spin text-[var(--muted)]" /> : <CornerDownLeft size={13} className="text-[var(--muted)]" />}
            </button>
          )}

          {aiAnswer && (
            <div className="mx-1 my-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-sm text-[var(--text)] whitespace-pre-wrap">
              {aiAnswer}
            </div>
          )}

          {results.nav.length > 0 && (
            <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Go to</div>
          )}
          {results.nav.map((e) => (
            <button key={e.path} onClick={() => go(e.path)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--surface-3)] text-left">
              <Search size={14} className="text-[var(--muted)] shrink-0" />
              <span className="text-sm flex-1">{e.label}</span>
              <span className="text-xs text-[var(--muted)]">{e.sublabel}</span>
            </button>
          ))}

          {results.content.length > 0 && (
            <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Your content</div>
          )}
          {results.content.map((c, i) => (
            <button key={i} onClick={() => go(c.path)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--surface-3)] text-left">
              <c.icon size={14} className="text-[var(--muted)] shrink-0" />
              <span className="text-sm flex-1">{c.label}</span>
              <span className="text-xs text-[var(--muted)]">{c.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface ContentHit {
  icon: typeof FileText
  label: string
  sub: string
  path: string
}
