import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Radio, Plus, Users, ArrowRight, Copy, Check, Calendar, ShieldCheck,
} from 'lucide-react'
import { useAppStore } from '../store'
import { usePersistStore } from '../store/persist'
import { generateRoomId, formatDate } from '../lib/utils'
import SectionShell from '../components/SectionShell'
import { sectionById } from '../lib/ia'
import { getPresence } from '../lib/presenceClient'
import type { Presence } from '../lib/monitor'

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
  const setDisplayName = useAppStore((s) => s.setDisplayName)
  const rooms = useAppStore((s) => s.rooms)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)

  function join(e: React.FormEvent) {
    e.preventDefault()
    const c = code.trim()
    if (!c) { setErr('Enter a room code to join.'); return }
    // Only join a session that actually exists. A typo or junk code must NOT
    // open a room or spin up a public Jitsi meeting (LLP-143). Attendees on
    // other devices join via the host's share link (which points straight at
    // the room), so the typed code only needs to match a known session here.
    const known = rooms.find((r) => r.id.toLowerCase() === c.toLowerCase() && r.state === 'active')
    if (!known) { setErr('Session not found. Check the code, or use the host’s share link.'); return }
    setDisplayName(name.trim() || 'Guest')
    navigate({ to: '/live/$roomId', params: { roomId: known.id } })
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
  const [err, setErr] = useState<string | null>(null)

  function create(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    // Empty Start used to do nothing silently — now it explains why (LLP-143).
    if (!n) { setErr('Enter a session name to start.'); return }
    setDisplayName(host.trim() || 'Host')
    const id = generateRoomId()
    addRoom({ id, name: n, participants: 1, createdAt: new Date(), isActive: true, state: 'active', tokenUsage: 0, tokenCeiling: 50000, host: host.trim() || 'Host' })
    logActivity('live', `Started session "${n}"`)
    navigate({ to: '/live/$roomId', params: { roomId: id } })
  }

  return (
    <div>
      <form onSubmit={create} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row gap-2">
        <input value={name} onChange={(e) => { setName(e.target.value); if (err) setErr(null) }} placeholder="New session name…" className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Host name" className="sm:w-40 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"><Plus size={15} /> Start</button>
      </form>
      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
    </div>
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

  if (filter === 'upcoming') {
    // No scheduling backend yet — show an honest empty state rather than
    // fabricated "Tomorrow 3pm" events with dead buttons.
    return (
      <div className="text-center py-16">
        <Calendar size={22} className="mx-auto mb-2 text-[var(--muted)] opacity-50" />
        <p className="text-sm text-[var(--muted)]">No upcoming sessions scheduled.</p>
        <p className="text-xs text-[var(--muted)] mt-1">Start a session from “Live now” to go live instantly.</p>
      </div>
    )
  }

  const list = rooms.filter((r) => r.state === 'ended')
  if (list.length === 0) return <div className="text-center py-16 text-sm text-[var(--muted)]">No past sessions yet.</div>
  return (
    <div className="space-y-2">
      {list.map((r) => (
        <div key={r.id} className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <Radio size={16} className="text-[var(--muted)]" />
          <div className="flex-1"><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-[var(--muted)]">{formatDate(r.createdAt)}{r.host ? ` · ${r.host}` : ''}</p></div>
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

/** Facilitator Console (LLP-123): live participant monitor across active
 *  sessions, driven by real room-presence heartbeats (LLP-82) — no fabricated
 *  attendees or engagement feed. */
function FacilitatorConsole() {
  const rooms = useAppStore((s) => s.rooms)
  const activeIds = rooms.filter((r) => r.state === 'active').map((r) => r.id)
  const key = activeIds.join(',')
  const [presence, setPresence] = useState<Record<string, Presence[]>>({})

  useEffect(() => {
    if (!activeIds.length) { setPresence({}); return }
    let stop = false
    const load = () => { void getPresence(activeIds).then((p) => { if (!stop) setPresence(p) }) }
    load()
    const t = setInterval(load, 5000)
    return () => { stop = true; clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? id
  const entries = Object.entries(presence)
    .flatMap(([roomId, list]) => list.map((p) => ({ roomId, ...p })))
    .sort((a, b) => b.lastSeen - a.lastSeen)
  const liveCount = entries.length

  return (
    <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-sm font-semibold flex-1">Facilitator Console</h3>
        <span className="flex items-center gap-1 text-[11px] text-[var(--muted)]"><Users size={12} /> {liveCount} live</span>
      </div>
      <p className="text-xs font-semibold text-[var(--muted)] mb-2 flex items-center gap-1"><Users size={12} /> Live participants</p>
      {activeIds.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No active sessions right now.</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No participants detected yet. Live presence appears here once attendees join a session.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((p) => (
            <div key={`${p.roomId}:${p.identity}`} className="flex items-center gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="flex-1 truncate">{p.identity}</span>
              <span className="text-[11px] text-[var(--muted)] truncate max-w-[45%]">{roomName(p.roomId)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
