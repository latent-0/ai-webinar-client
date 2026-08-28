import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Radio, Plus, Users, ArrowRight, Copy, Check, Calendar, Megaphone, Hand, Activity, ShieldCheck,
} from 'lucide-react'
import { useAppStore } from '../store'
import { usePersistStore } from '../store/persist'
import { generateRoomId, formatDate } from '../lib/utils'
import SectionShell from '../components/SectionShell'
import { sectionById } from '../lib/ia'

/**
 * Live section (LLP-115) — interactive experiences across Upcoming / Live Now /
 * Past / Calendar, plus a role-gated Facilitator Console (LLP-123).
 */
export default function LiveSection() {
  const section = sectionById('live')!
  return (
    <SectionShell section={section} defaultTab="live-now" actions={<JoinButton />}>
      {(tab) => {
        if (tab === 'upcoming') return <EventList filter="upcoming" />
        if (tab === 'past') return <EventList filter="past" />
        if (tab === 'calendar') return <CalendarView />
        return <LiveNow />
      }}
    </SectionShell>
  )
}

function JoinButton() {
  const rooms = useAppStore((s) => s.rooms)
  const setDisplayName = useAppStore((s) => s.setDisplayName)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)

  function join(e: React.FormEvent) {
    e.preventDefault()
    const c = code.trim()
    if (!rooms.find((r) => r.id === c)) { setErr("That room code wasn't found."); return }
    setDisplayName(name.trim() || 'Guest')
    navigate({ to: '/live/$roomId', params: { roomId: c } })
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-3)] text-sm font-medium">
        <ArrowRight size={15} /> Join by code
      </button>
      {open && (
        <form onSubmit={join} className="absolute right-0 mt-1 w-64 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg z-30 space-y-2">
          <input value={code} onChange={(e) => { setCode(e.target.value); setErr(null) }} placeholder="Room code" className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <button type="submit" className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Join</button>
        </form>
      )}
    </div>
  )
}

function LiveNow() {
  const rooms = useAppStore((s) => s.rooms)
  const role = usePersistStore((s) => s.role)
  const active = rooms.filter((r) => r.state === 'active')

  return (
    <div className="space-y-6">
      {role === 'facilitator' && <FacilitatorConsole />}
      <CreateSession />
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live now</h3>
        {active.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No live sessions right now.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{active.map((r) => <RoomCard key={r.id} id={r.id} />)}</div>
        )}
      </div>
    </div>
  )
}

function CreateSession() {
  const addRoom = useAppStore((s) => s.addRoom)
  const setDisplayName = useAppStore((s) => s.setDisplayName)
  const logActivity = usePersistStore((s) => s.logActivity)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [host, setHost] = useState('')

  function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setDisplayName(host.trim() || 'Host')
    const id = generateRoomId()
    addRoom({ id, name: name.trim(), participants: 1, createdAt: new Date(), isActive: true, state: 'active', tokenUsage: 0, tokenCeiling: 50000, host: host.trim() || 'Host' })
    logActivity('live', `Started session "${name.trim()}"`)
    navigate({ to: '/live/$roomId', params: { roomId: id } })
  }

  return (
    <form onSubmit={create} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New session name…" className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Host name" className="sm:w-40 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"><Plus size={15} /> Start</button>
    </form>
  )
}

function RoomCard({ id }: { id: string }) {
  const room = useAppStore((s) => s.rooms.find((r) => r.id === id))
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  if (!room) return null
  return (
    <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col">
      <div className="flex items-center gap-2 mb-2"><Radio size={15} className="text-red-500" /><p className="text-sm font-semibold leading-tight flex-1 truncate">{room.name}</p></div>
      <p className="text-xs text-[var(--muted)] mb-3 flex items-center gap-1"><Users size={12} /> {room.participants} · {room.host ?? 'Host'}</p>
      <div className="flex items-center gap-2 mt-auto">
        <button onClick={() => navigate({ to: '/live/$roomId', params: { roomId: room.id } })} className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Enter</button>
        <button onClick={async () => { await navigator.clipboard.writeText(room.id); setCopied(true); setTimeout(() => setCopied(false), 1500) }} title="Copy code" className="p-1.5 rounded-lg border border-[var(--border)]">{copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-[var(--muted)]" />}</button>
      </div>
    </div>
  )
}

function EventList({ filter }: { filter: 'upcoming' | 'past' }) {
  const rooms = useAppStore((s) => s.rooms)
  const list = filter === 'past' ? rooms.filter((r) => r.state === 'ended') : []
  const upcoming = [
    { id: 'u1', name: 'Advanced Prompting Workshop', when: 'Tomorrow, 3:00 PM' },
    { id: 'u2', name: 'Analytics Deep-Dive', when: 'Fri, 11:00 AM' },
  ]
  if (filter === 'upcoming') {
    return (
      <div className="space-y-2">
        {upcoming.map((e) => (
          <div key={e.id} className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <Calendar size={16} className="text-indigo-500" />
            <div className="flex-1"><p className="text-sm font-medium">{e.name}</p><p className="text-xs text-[var(--muted)]">{e.when}</p></div>
            <button className="text-xs px-3 py-1.5 rounded-lg bg-[var(--surface-3)] font-medium">Remind me</button>
          </div>
        ))}
      </div>
    )
  }
  if (list.length === 0) return <div className="text-center py-16 text-sm text-[var(--muted)]">No past events yet.</div>
  return (
    <div className="space-y-2">
      {list.map((r) => (
        <div key={r.id} className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <Radio size={16} className="text-[var(--muted)]" />
          <div className="flex-1"><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-[var(--muted)]">{formatDate(r.createdAt)} · {r.participants} attended</p></div>
          <button className="text-xs px-3 py-1.5 rounded-lg bg-[var(--surface-3)] font-medium">Recap</button>
        </div>
      ))}
    </div>
  )
}

function CalendarView() {
  const rooms = useAppStore((s) => s.rooms)
  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--muted)] mb-3">All your sessions, deadlines and events in one view.</p>
      {rooms.map((r) => (
        <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="w-12 text-center"><p className="text-[10px] text-[var(--muted)] uppercase">{formatDate(r.createdAt).split(' ')[0]}</p></div>
          <div className="flex-1"><p className="text-sm font-medium">{r.name}</p></div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${r.state === 'active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-[var(--surface-3)] text-[var(--muted)]'}`}>{r.state}</span>
        </div>
      ))}
    </div>
  )
}

/** Facilitator Console (LLP-123): monitor participants, engagement, broadcast, consent-gated assist. */
function FacilitatorConsole() {
  const [broadcast, setBroadcast] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [assistFor, setAssistFor] = useState<string | null>(null)
  const participants = [
    { name: 'Sophie', status: 'engaged' as const },
    { name: 'Alex', status: 'stuck' as const },
    { name: 'Priya', status: 'inactive' as const },
  ]
  return (
    <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30">
      <div className="flex items-center gap-2 mb-4"><ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" /><h3 className="text-sm font-semibold">Facilitator Console</h3></div>
      <div className="grid md:grid-cols-3 gap-4">
        {/* Participants */}
        <div>
          <p className="text-xs font-semibold text-[var(--muted)] mb-2 flex items-center gap-1"><Users size={12} /> Participants</p>
          <div className="space-y-1.5">
            {participants.map((p) => (
              <div key={p.name} className="flex items-center gap-2 text-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'engaged' ? 'bg-emerald-500' : p.status === 'stuck' ? 'bg-amber-500' : 'bg-[var(--muted)]'}`} />
                <span className="flex-1">{p.name}</span>
                {p.status !== 'engaged' && <button onClick={() => setAssistFor(p.name)} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">Assist</button>}
              </div>
            ))}
          </div>
        </div>
        {/* Engagement */}
        <div>
          <p className="text-xs font-semibold text-[var(--muted)] mb-2 flex items-center gap-1"><Activity size={12} /> Engagement</p>
          <div className="space-y-2 text-xs text-[var(--muted)]">
            <div>Sophie asked a question</div>
            <div>3 reactions in last minute</div>
            <div>Poll: 8/12 responded</div>
          </div>
        </div>
        {/* Broadcast */}
        <div>
          <p className="text-xs font-semibold text-[var(--muted)] mb-2 flex items-center gap-1"><Megaphone size={12} /> Broadcast</p>
          <form onSubmit={(e) => { e.preventDefault(); if (broadcast.trim()) { setSent(broadcast.trim()); setBroadcast('') } }} className="space-y-2">
            <input value={broadcast} onChange={(e) => setBroadcast(e.target.value)} placeholder="Message all…" className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Send to all</button>
          </form>
          {sent && <p className="text-[11px] text-emerald-600 mt-1.5">Sent: “{sent}”</p>}
        </div>
      </div>

      {/* Consent-gated assist */}
      {assistFor && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4" onClick={() => setAssistFor(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2"><Hand size={16} className="text-indigo-500" /><h4 className="text-sm font-semibold">Request to assist {assistFor}</h4></div>
            <p className="text-xs text-[var(--muted)] mb-4">{assistFor} must consent before you can view or co-edit their screen. A request will be sent and you'll wait for approval.</p>
            <div className="flex gap-2">
              <button onClick={() => setAssistFor(null)} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm font-medium">Cancel</button>
              <button onClick={() => setAssistFor(null)} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Send request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
