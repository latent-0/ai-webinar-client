import { useState, useRef, useEffect } from 'react'
import { BookOpen, Send, Sparkles, Search, GraduationCap, Award, FileText, Loader2 } from 'lucide-react'
import SectionShell from '../components/SectionShell'
import { sectionById } from '../lib/ia'
import { runAgent, TOOLS } from '../lib/agents'
import { usePersistStore, allowedProvidersFromSettings } from '../store/persist'

/**
 * Learn section (LLP-116) — Knowledge Hub, My Learning, Smart Search, AI Assistant.
 * Assistant/search run through the unified agent core; My Learning reads the
 * persistent layer.
 */
export default function LearnSection() {
  const section = sectionById('learn')!
  return (
    <SectionShell section={section} defaultTab="hub">
      {(tab) => {
        if (tab === 'my-learning') return <MyLearning />
        if (tab === 'search') return <SmartSearch />
        if (tab === 'assistant') return <Assistant />
        return <KnowledgeHub />
      }}
    </SectionShell>
  )
}

const TOPICS = ['Search campaigns', 'Performance Max', 'Quality Score', 'Smart Bidding', 'Keywords & match types', 'Conversion tracking']

function KnowledgeHub() {
  const library = usePersistStore((s) => s.library)
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Topics</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TOPICS.map((t) => (
            <div key={t} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:shadow-sm transition-shadow cursor-default">
              <BookOpen size={16} className="text-indigo-500 mb-2" />
              <p className="text-sm font-medium">{t}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-3">Recommended for you</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {library.slice(0, 6).map((i) => (
            <div key={i.id} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)]">{i.kind}</span>
              <p className="text-sm font-semibold mt-1">{i.title}</p>
              {i.summary && <p className="text-xs text-[var(--muted)] mt-1">{i.summary}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MyLearning() {
  const library = usePersistStore((s) => s.library)
  const settings = usePersistStore((s) => s.settings)
  const addNote = usePersistStore((s) => s.addNote)
  const [topic, setTopic] = useState('')
  const [path, setPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    if (!topic.trim() || loading) return
    setLoading(true); setPath(null)
    try {
      const { answer } = await TOOLS.learningPath.run(topic.trim(), { allowedProviders: allowedProvidersFromSettings(settings) })
      setPath(answer)
    } catch { setPath('Could not generate a path right now.') } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><GraduationCap size={15} /> Continue learning</h3>
        <div className="space-y-2">
          {library.slice(0, 4).map((i) => (
            <div key={i.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-3)] flex items-center justify-center text-xs uppercase text-[var(--muted)]">{i.kind[0]}</div>
              <p className="text-sm font-medium flex-1 truncate">{i.title}</p>
              <button className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">Resume</button>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles size={15} className="text-indigo-500" /> Generate a learning path</h3>
        <div className="flex gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') generate() }} placeholder="e.g. Google Ads for beginners" className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={generate} disabled={loading} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-1.5">{loading ? <Loader2 size={15} className="animate-spin" /> : 'Generate'}</button>
        </div>
        {path && (
          <div className="mt-3 p-3 rounded-xl bg-[var(--bg)] text-sm whitespace-pre-wrap">{path}
            <button onClick={() => addNote({ title: `Learning path: ${topic}`, body: path, aiGenerated: true, topic })} className="mt-2 block text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Save to notes</button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Award size={15} /> Certificates</h3>
        <p className="text-sm text-[var(--muted)]">Complete a learning path to earn your first certificate.</p>
      </div>
    </div>
  )
}

function SmartSearch() {
  const settings = usePersistStore((s) => s.settings)
  const addSavedSearch = usePersistStore((s) => s.addSavedSearch)
  const savedSearches = usePersistStore((s) => s.savedSearches)
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!q.trim() || loading) return
    setLoading(true); setAnswer(null); addSavedSearch(q.trim())
    try {
      const { answer } = await runAgent('assistant', q.trim(), { allowedProviders: allowedProvidersFromSettings(settings), overrideModelId: settings.aiModelPreference })
      setAnswer(answer)
    } catch { setAnswer('Search is unavailable right now.') } finally { setLoading(false) }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search() }} placeholder="Ask anything, in natural language…" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <button onClick={search} disabled={loading} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-1.5">{loading ? <Loader2 size={15} className="animate-spin" /> : 'Search'}</button>
      </div>
      {savedSearches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {savedSearches.slice(0, 6).map((s) => (
            <button key={s} onClick={() => setQ(s)} className="text-xs px-2.5 py-1 rounded-full bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--text)]">{s}</button>
          ))}
        </div>
      )}
      {answer && <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-sm whitespace-pre-wrap">{answer}</div>}
    </div>
  )
}

interface Msg { id: string; role: 'user' | 'assistant'; content: string }

function Assistant() {
  const settings = usePersistStore((s) => s.settings)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const q = input.trim(); setInput('')
    setMsgs((m) => [...m, { id: String(m.length), role: 'user', content: q }])
    setLoading(true)
    try {
      const { answer } = await runAgent('assistant', q, { allowedProviders: allowedProvidersFromSettings(settings), overrideModelId: settings.aiModelPreference })
      setMsgs((m) => [...m, { id: String(m.length + 1), role: 'assistant', content: answer }])
    } catch {
      setMsgs((m) => [...m, { id: String(m.length + 1), role: 'assistant', content: 'The assistant is unavailable right now.' }])
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-2xl flex flex-col h-[60vh]">
      <div className="flex-1 overflow-y-auto space-y-3 mb-3">
        {msgs.length === 0 && (
          <div className="text-center py-16 text-sm text-[var(--muted)]"><FileText size={24} className="mx-auto mb-2 opacity-50" />Ask a question, explain a topic, or summarize content.</div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-[var(--surface)] border border-[var(--border)]'}`}>{m.content}</div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]"><Loader2 size={15} className="animate-spin text-[var(--muted)]" /></div></div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message the assistant…" className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button type="submit" disabled={loading} className="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white inline-flex items-center"><Send size={16} /></button>
      </form>
    </div>
  )
}
