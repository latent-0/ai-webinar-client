import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Gamepad2, Plus, FileInput, Layers, Eye, Bot, Hand, Sparkles, Play, CheckCircle2, Loader2 } from 'lucide-react'
import SectionShell from '../components/SectionShell'
import { sectionById } from '../lib/ia'
import { runAgent } from '../lib/agents'
import { usePersistStore, allowedProvidersFromSettings } from '../store/persist'

/**
 * Play section (LLP-117) — Play Home, Play Modes, Scenarios, Validation & Feedback.
 * The deep play space is the Canvas/Workspace; scenarios & feedback use the agent core.
 */
export default function PlaySection() {
  const section = sectionById('play')!
  return (
    <SectionShell section={section} defaultTab="home">
      {(tab) => {
        if (tab === 'modes') return <PlayModes />
        if (tab === 'scenarios') return <Scenarios />
        if (tab === 'feedback') return <Feedback />
        return <PlayHome />
      }}
    </SectionShell>
  )
}

function PlayHome() {
  const navigate = useNavigate()
  const logActivity = usePersistStore((s) => s.logActivity)
  const open = (label: string) => { logActivity('play', label); navigate({ to: '/canvas' }) }
  const starters = [
    { label: 'Start from template', icon: Layers, desc: 'Pick a ready-made scenario.' },
    { label: 'Start blank', icon: Plus, desc: 'Open an empty play space.' },
    { label: 'Import scenario', icon: FileInput, desc: 'Bring in an existing setup.' },
  ]
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-3">
        {starters.map((s) => (
          <button key={s.label} onClick={() => open(s.label)} className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center mb-3"><s.icon size={17} className="text-indigo-600 dark:text-indigo-400" /></div>
            <p className="text-sm font-semibold">{s.label}</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">{s.desc}</p>
          </button>
        ))}
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-3">Recent play sessions</h3>
        <div className="space-y-2">
          {['Build a Search campaign', 'Write a responsive search ad', 'Plan a negative keyword list'].map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <Gamepad2 size={15} className="text-violet-500" />
              <p className="text-sm font-medium flex-1">{s}</p>
              <button onClick={() => open(`Resumed "${s}"`)} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--surface-3)] font-medium">Resume</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const MODES = [
  { id: 'supervision', label: 'Supervision (Manual)', icon: Eye, desc: 'You drive; the AI watches and only helps if asked.' },
  { id: 'guidance', label: 'Guidance (AI)', icon: Bot, desc: 'The AI suggests next steps as you work.' },
  { id: 'doing', label: 'Doing (You)', icon: Hand, desc: 'Full hands-on — you do everything yourself.' },
]

function PlayModes() {
  const [mode, setMode] = useState('guidance')
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {MODES.map((m) => {
        const active = m.id === mode
        return (
          <button key={m.id} onClick={() => setMode(m.id)} className={`p-5 rounded-2xl border text-left transition-all ${active ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30' : 'border-[var(--border)] bg-[var(--surface)] hover:shadow-sm'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center"><m.icon size={17} className="text-indigo-600 dark:text-indigo-400" /></div>
              {active && <CheckCircle2 size={16} className="text-indigo-600" />}
            </div>
            <p className="text-sm font-semibold">{m.label}</p>
            <p className="text-xs text-[var(--muted)] mt-1">{m.desc}</p>
          </button>
        )
      })}
    </div>
  )
}

function Scenarios() {
  const settings = usePersistStore((s) => s.settings)
  const [prompt, setPrompt] = useState('')
  const [generated, setGenerated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const library = [
    { title: 'Build your first Search campaign', level: 'Beginner' },
    { title: 'Structure ad groups & keywords', level: 'Intermediate' },
    { title: 'Set up conversion tracking', level: 'Intermediate' },
    { title: 'Migrate to Target ROAS bidding', level: 'Advanced' },
  ]
  async function gen() {
    if (!prompt.trim() || loading) return
    setLoading(true); setGenerated(null)
    try {
      const { answer } = await runAgent('sandbox', `Design a hands-on practice scenario for: ${prompt.trim()}. Give a title, goal, and 3 steps.`, { allowedProviders: allowedProvidersFromSettings(settings), skipRetrieval: true })
      setGenerated(answer)
    } catch { setGenerated('Could not generate a scenario right now.') } finally { setLoading(false) }
  }
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles size={15} className="text-indigo-500" /> Generate a scenario with AI</h3>
        <div className="flex gap-2">
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') gen() }} placeholder="What do you want to practise?" className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={gen} disabled={loading} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-1.5">{loading ? <Loader2 size={15} className="animate-spin" /> : 'Generate'}</button>
        </div>
        {generated && <div className="mt-3 p-3 rounded-xl bg-[var(--bg)] text-sm whitespace-pre-wrap">{generated}</div>}
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-3">Scenario library</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {library.map((s) => (
            <div key={s.title} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex items-center gap-3">
              <div className="flex-1"><p className="text-sm font-medium">{s.title}</p><p className="text-xs text-[var(--muted)]">{s.level}</p></div>
              <button className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium inline-flex items-center gap-1"><Play size={12} /> Run</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Feedback() {
  const settings = usePersistStore((s) => s.settings)
  const [work, setWork] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  async function run() {
    if (!work.trim() || loading) return
    setLoading(true); setResult(null)
    try {
      const { answer } = await runAgent('sandbox', `Review this work and give specific, actionable feedback with a score out of 10:\n\n${work.trim()}`, { allowedProviders: allowedProvidersFromSettings(settings) })
      setResult(answer)
    } catch { setResult('Feedback is unavailable right now.') } finally { setLoading(false) }
  }
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-[var(--muted)]">Paste your work to run it against the goal and get AI feedback.</p>
      <textarea value={work} onChange={(e) => setWork(e.target.value)} rows={5} placeholder="Paste your solution, copy, plan…" className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <button onClick={run} disabled={loading} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-1.5">{loading ? <><Loader2 size={15} className="animate-spin" /> Running…</> : <><Play size={14} /> Run & get feedback</>}</button>
      {result && <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-sm whitespace-pre-wrap">{result}</div>}
    </div>
  )
}
