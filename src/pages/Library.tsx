import { useState, useEffect } from 'react'
import { Bookmark, Trash2, Plus, FileText, Brain, Database, Clock, X, HardDrive, ExternalLink, Loader2 } from 'lucide-react'
import SectionShell from '../components/SectionShell'
import { sectionById } from '../lib/ia'
import { usePersistStore, type AiMemory } from '../store/persist'
import { getDriveFiles, GOOGLE_CONNECT_URL, type DriveFile } from '../lib/integrationsClient'

/**
 * Library (LLP-118) — My content & history, notes, sources, AI memory.
 * Fully functional against the persistent layer.
 */
export default function Library() {
  const section = sectionById('library')!
  return (
    <SectionShell section={section} defaultTab="all">
      {(tab) => {
        if (tab === 'notes') return <NotesPanel />
        if (tab === 'history') return <HistoryPanel />
        if (tab === 'sources') return <SourcesPanel />
        if (tab === 'memory') return <MemoryPanel />
        return <ContentPanel savedOnly={tab === 'saved'} />
      }}
    </SectionShell>
  )
}

function ContentPanel({ savedOnly }: { savedOnly: boolean }) {
  const library = usePersistStore((s) => s.library)
  const toggleBookmark = usePersistStore((s) => s.toggleBookmark)
  const removeLibraryItem = usePersistStore((s) => s.removeLibraryItem)
  const [query, setQuery] = useState('')

  const items = library
    .filter((i) => (savedOnly ? i.bookmarked : true))
    .filter((i) => i.title.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter content…"
        className="w-full max-w-sm mb-4 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {items.length === 0 ? (
        <Empty label={savedOnly ? 'Nothing saved yet — bookmark items to see them here.' : 'No content found.'} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((i) => (
            <div key={i.id} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)] px-2 py-0.5 rounded-full bg-[var(--surface-3)]">{i.kind}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleBookmark(i.id)} title="Bookmark">
                    <Bookmark size={14} className={i.bookmarked ? 'text-indigo-500 fill-indigo-500' : 'text-[var(--muted)]'} />
                  </button>
                  <button onClick={() => removeLibraryItem(i.id)} title="Remove"><Trash2 size={14} className="text-[var(--muted)] hover:text-red-500" /></button>
                </div>
              </div>
              <p className="text-sm font-semibold leading-tight mb-1">{i.title}</p>
              {i.summary && <p className="text-xs text-[var(--muted)] leading-relaxed flex-1">{i.summary}</p>}
              <p className="text-[11px] text-[var(--muted)] mt-2 capitalize">From {i.origin}{i.topic ? ` · ${i.topic}` : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NotesPanel() {
  const notes = usePersistStore((s) => s.notes)
  const addNote = usePersistStore((s) => s.addNote)
  const updateNote = usePersistStore((s) => s.updateNote)
  const removeNote = usePersistStore((s) => s.removeNote)
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div>
      <button
        onClick={() => { const id = addNote({ title: 'New note', body: '', aiGenerated: false }); setEditing(id) }}
        className="mb-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
      >
        <Plus size={15} /> New note
      </button>
      {notes.length === 0 ? (
        <Empty label="No notes yet. Notes you take across Live, Learn and Play collect here." />
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              {editing === n.id ? (
                <div className="space-y-2">
                  <input
                    value={n.title}
                    onChange={(e) => updateNote(n.id, { title: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <textarea
                    value={n.body}
                    onChange={(e) => updateNote(n.id, { body: e.target.value })}
                    rows={4}
                    placeholder="Write your note…"
                    className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={() => setEditing(null)} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--surface-3)] font-medium">Done</button>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      {n.aiGenerated && <FileText size={13} className="text-indigo-500" />}
                      {n.title || 'Untitled'}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setEditing(n.id)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Edit</button>
                      <button onClick={() => removeNote(n.id)}><Trash2 size={13} className="text-[var(--muted)] hover:text-red-500" /></button>
                    </div>
                  </div>
                  {n.body && <p className="text-xs text-[var(--muted)] mt-1 whitespace-pre-wrap">{n.body}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryPanel() {
  const activity = usePersistStore((s) => s.activity)
  if (activity.length === 0) return <Empty label="No history yet." />
  return (
    <div className="space-y-2">
      {activity.map((a) => (
        <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <Clock size={14} className="text-[var(--muted)]" />
          <span className="text-sm flex-1"><span className="capitalize font-medium">{a.surface}</span> — {a.label}</span>
        </div>
      ))}
    </div>
  )
}

function SourcesPanel() {
  const library = usePersistStore((s) => s.library)
  const notes = usePersistStore((s) => s.notes)
  // Real, store-derived counts — no fabricated "healthy / 3 items" statuses.
  const sources = [
    { name: 'Saved content', count: library.length, hint: 'Items saved across Live, Learn and Play.' },
    { name: 'Notes', count: notes.length, hint: 'Notes you have written or generated.' },
  ]
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sources.map((s) => (
          <div key={s.name} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center gap-2 mb-2"><Database size={15} className="text-[var(--muted)]" /><p className="text-sm font-semibold">{s.name}</p></div>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs text-[var(--muted)] mt-1">{s.hint}</p>
          </div>
        ))}
      </div>
      <DriveSources />
    </div>
  )
}

const FILE_KINDS: Record<string, string> = {
  'application/vnd.google-apps.document': 'Doc',
  'application/vnd.google-apps.spreadsheet': 'Sheet',
  'application/vnd.google-apps.presentation': 'Slides',
  'application/vnd.google-apps.folder': 'Folder',
  'application/pdf': 'PDF',
}
function fileKind(mime: string) {
  return FILE_KINDS[mime] || mime.split('/').pop()?.toUpperCase().slice(0, 6) || 'File'
}

/** Real Google Drive files (read-only) when the user has connected Google. */
function DriveSources() {
  const [state, setState] = useState<{ loading: boolean; connected: boolean; files: DriveFile[] }>({ loading: true, connected: false, files: [] })

  useEffect(() => {
    let stop = false
    void getDriveFiles().then((r) => { if (!stop) setState({ loading: false, connected: r.connected, files: r.files }) })
    return () => { stop = true }
  }, [])

  return (
    <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 mb-3">
        <HardDrive size={15} className="text-[var(--muted)]" />
        <p className="text-sm font-semibold flex-1">Google Drive</p>
        {state.loading ? (
          <Loader2 size={14} className="animate-spin text-[var(--muted)]" />
        ) : state.connected ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">Connected</span>
        ) : (
          <a href={GOOGLE_CONNECT_URL} className="text-xs px-3 py-1.5 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-500">Connect</a>
        )}
      </div>
      {state.loading ? null : !state.connected ? (
        <p className="text-xs text-[var(--muted)]">Connect Google to browse your recent Drive files here (read-only).</p>
      ) : state.files.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No files found in your Drive.</p>
      ) : (
        <div className="space-y-1.5">
          {state.files.map((f) => (
            <a key={f.id} href={f.url ?? undefined} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--surface-3)] transition-colors group">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--muted)] shrink-0 w-14 text-center">{fileKind(f.mimeType)}</span>
              <span className="text-sm flex-1 truncate">{f.name}</span>
              <ExternalLink size={12} className="text-[var(--muted)] opacity-0 group-hover:opacity-100 shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function MemoryPanel() {
  const aiMemory = usePersistStore((s) => s.aiMemory)
  const addAiMemory = usePersistStore((s) => s.addAiMemory)
  const removeAiMemory = usePersistStore((s) => s.removeAiMemory)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const buckets: { key: keyof AiMemory; label: string; hint: string }[] = [
    { key: 'facts', label: 'What the AI knows', hint: 'Facts about you it uses for context.' },
    { key: 'preferences', label: 'Preferences', hint: 'How you like the AI to respond.' },
    { key: 'corrections', label: 'Corrections', hint: "Things you've told it to change." },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Brain size={16} className="text-indigo-500" />
        You control what the assistant remembers. Edits here take effect immediately.
      </div>
      {buckets.map((b) => (
        <div key={b.key} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <p className="text-sm font-semibold">{b.label}</p>
          <p className="text-xs text-[var(--muted)] mb-3">{b.hint}</p>
          <div className="space-y-1.5 mb-3">
            {aiMemory[b.key].length === 0 && <p className="text-xs text-[var(--muted)] italic">Nothing yet.</p>}
            {aiMemory[b.key].map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-[var(--surface-3)] rounded-lg px-3 py-1.5">
                <span className="flex-1">{v}</span>
                <button onClick={() => removeAiMemory(b.key, i)}><X size={13} className="text-[var(--muted)] hover:text-red-500" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={drafts[b.key] ?? ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [b.key]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter' && drafts[b.key]?.trim()) { addAiMemory(b.key, drafts[b.key].trim()); setDrafts((d) => ({ ...d, [b.key]: '' })) } }}
              placeholder={`Add to ${b.label.toLowerCase()}…`}
              className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <div className="text-center py-16 text-sm text-[var(--muted)]">{label}</div>
}
