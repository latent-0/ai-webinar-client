/**
 * Analytics (LLP-120) — progress & insights across 4 IA tabs:
 * My Insights, Live Analytics, Play Analytics, Team / Org.
 * Reads real data from the session store (rooms) and the persistent layer
 * (library, notes, projects, activity, AI memory).
 */

import { Users, MessageSquare, Bot, Radio, BookOpen, Target, Award, Download } from 'lucide-react'
import { useAppStore } from '../store'
import { usePersistStore } from '../store/persist'
import { formatDate } from '../lib/utils'
import SectionShell from '../components/SectionShell'
import { sectionById } from '../lib/ia'

function StatCard({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: React.ElementType; hint?: string }) {
  return (
    <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm flex items-start gap-4">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[var(--muted)] font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-[var(--text)] tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-[var(--muted)] mt-0.5">{hint}</p>}
      </div>
    </div>
  )
}

function Bar({ label, pct, sub }: { label: string; pct: number; sub?: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-[var(--muted)] tabular-nums">{sub ?? `${Math.round(clamped)}%`}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

export default function Analytics() {
  const section = sectionById('analytics')!
  return (
    <SectionShell section={section} defaultTab="insights">
      {(tab) => {
        if (tab === 'live') return <LiveAnalytics />
        if (tab === 'play') return <PlayAnalytics />
        if (tab === 'team') return <TeamInsights />
        return <MyInsights />
      }}
    </SectionShell>
  )
}

const SURFACES = ['live', 'learn', 'play', 'library', 'projects'] as const

function MyInsights() {
  const library = usePersistStore((s) => s.library)
  const notes = usePersistStore((s) => s.notes)
  const activity = usePersistStore((s) => s.activity)
  const projects = usePersistStore((s) => s.projects)

  const tasksDone = projects.reduce((n, p) => n + p.tasks.filter((t) => t.done).length, 0)
  const tasksTotal = projects.reduce((n, p) => n + p.tasks.length, 0)

  // Real breakdown of what you've actually done, per area — computed from
  // logged activity, not a fabricated "skills matrix".
  const byArea = SURFACES.map((s) => ({ label: s, n: activity.filter((a) => a.surface === s).length }))
    .filter((a) => a.n > 0)
  const maxArea = Math.max(1, ...byArea.map((a) => a.n))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Items learned" value={library.length} icon={BookOpen} />
        <StatCard label="Notes taken" value={notes.length} icon={MessageSquare} />
        <StatCard label="Tasks completed" value={`${tasksDone}/${tasksTotal}`} icon={Target} />
        <StatCard label="Activity events" value={activity.length} icon={Award} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
          <h3 className="text-sm font-semibold mb-4">Activity by area</h3>
          {byArea.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No activity yet. Your usage across Live, Learn and Play will show here.</p>
          ) : (
            <div className="space-y-4">
              {byArea.map((a) => <Bar key={a.label} label={a.label[0].toUpperCase() + a.label.slice(1)} pct={(a.n / maxArea) * 100} sub={String(a.n)} />)}
            </div>
          )}
        </div>
        <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
          <h3 className="text-sm font-semibold mb-4">Recent activity</h3>
          {activity.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nothing yet — your recent actions will appear here.</p>
          ) : (
            <div className="space-y-2">
              {activity.slice(0, 7).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span className="capitalize font-medium">{a.surface}</span>
                  <span className="text-[var(--muted)] truncate">— {a.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LiveAnalytics() {
  const rooms = useAppStore((s) => s.rooms)
  const totalSessions = rooms.length
  const activeNow = rooms.filter((r) => r.state === 'active').length
  const totalTokens = rooms.reduce((s, r) => s + r.tokenUsage, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total sessions" value={totalSessions} icon={Radio} />
        <StatCard label="Active now" value={activeNow} icon={Users} />
        <StatCard label="Ended" value={totalSessions - activeNow} icon={Radio} />
        <StatCard label="AI tokens used" value={totalTokens.toLocaleString()} icon={Bot} />
      </div>
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]"><h3 className="text-sm font-semibold">Sessions</h3></div>
        {rooms.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--muted)]">No sessions yet. Create one in Live.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]">
                {['Name', 'Status', 'Participants', 'Tokens', 'Created'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rooms.map((room) => {
                  const pct = room.tokenCeiling > 0 ? Math.min((room.tokenUsage / room.tokenCeiling) * 100, 100) : 0
                  return (
                    <tr key={room.id} className="hover:bg-[var(--bg)]">
                      <td className="px-6 py-3"><p className="font-medium truncate max-w-[220px]">{room.name}</p>{room.domain && <p className="text-xs text-[var(--muted)]">{room.domain}</p>}</td>
                      <td className="px-6 py-3"><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${room.state === 'active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-[var(--surface-3)] text-[var(--muted)]'}`}>{room.state === 'active' ? 'Active' : 'Ended'}</span></td>
                      <td className="px-6 py-3 tabular-nums">{room.participants}</td>
                      <td className="px-6 py-3 min-w-[140px]"><div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden"><div className={`h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div></td>
                      <td className="px-6 py-3 text-[var(--muted)] whitespace-nowrap">{formatDate(room.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function PlayAnalytics() {
  const activity = usePersistStore((s) => s.activity)
  const playActivity = activity.filter((a) => a.surface === 'play')
  const playEvents = playActivity.length
  const scenariosRun = playActivity.filter((a) => /scenario/i.test(a.label)).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Practice sessions" value={playEvents} icon={Target} />
        <StatCard label="Scenarios run" value={scenariosRun} icon={Bot} />
      </div>
      <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
        <h3 className="text-sm font-semibold mb-4">Recent practice</h3>
        {playActivity.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No practice sessions yet. Run a scenario in Play to start tracking progress.</p>
        ) : (
          <div className="space-y-2">
            {playActivity.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                <span className="text-[var(--muted)] truncate">{a.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TeamInsights() {
  const role = usePersistStore((s) => s.role)
  const library = usePersistStore((s) => s.library)
  const notes = usePersistStore((s) => s.notes)
  const projects = usePersistStore((s) => s.projects)
  const activity = usePersistStore((s) => s.activity)
  const rooms = useAppStore((s) => s.rooms)

  if (role !== 'facilitator') {
    return <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--muted)]">Workspace insights are available to facilitators. Switch role from the top bar to view them.</div>
  }

  const active = rooms.filter((r) => r.state === 'active').length
  const ended = rooms.length - active
  const maxStatus = Math.max(1, active, ended)

  // Export the real workspace figures shown on this page — nothing fabricated.
  function exportReport() {
    const data = {
      generatedAt: new Date().toISOString(),
      sessions: rooms.length,
      activeSessions: active,
      contentItems: library.length,
      notes: notes.length,
      projects: projects.length,
      activityEvents: activity.length,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'workspace-report.json'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">Live figures for this workspace.</p>
        <button onClick={exportReport} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--surface-3)] font-medium"><Download size={13} /> Export report</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sessions" value={rooms.length} icon={Radio} />
        <StatCard label="Content items" value={library.length} icon={BookOpen} />
        <StatCard label="Notes" value={notes.length} icon={MessageSquare} />
        <StatCard label="Activity events" value={activity.length} icon={Award} />
      </div>
      <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
        <h3 className="text-sm font-semibold mb-4">Sessions by status</h3>
        {rooms.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No sessions yet.</p>
        ) : (
          <div className="space-y-4">
            <Bar label="Active" pct={(active / maxStatus) * 100} sub={String(active)} />
            <Bar label="Ended" pct={(ended / maxStatus) * 100} sub={String(ended)} />
          </div>
        )}
      </div>
    </div>
  )
}
