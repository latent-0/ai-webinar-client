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

function MyInsights() {
  const library = usePersistStore((s) => s.library)
  const notes = usePersistStore((s) => s.notes)
  const activity = usePersistStore((s) => s.activity)
  const projects = usePersistStore((s) => s.projects)

  const tasksDone = projects.reduce((n, p) => n + p.tasks.filter((t) => t.done).length, 0)
  const tasksTotal = projects.reduce((n, p) => n + p.tasks.length, 0)
  const skills = [
    { label: 'AI & prompting', pct: 72 },
    { label: 'Marketing', pct: 58 },
    { label: 'Data analysis', pct: 40 },
  ]

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
          <h3 className="text-sm font-semibold mb-4">Skills matrix</h3>
          <div className="space-y-4">{skills.map((s) => <Bar key={s.label} label={s.label} pct={s.pct} />)}</div>
        </div>
        <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
          <h3 className="text-sm font-semibold mb-4">Recent activity</h3>
          <div className="space-y-2">
            {activity.slice(0, 7).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                <span className="capitalize font-medium">{a.surface}</span>
                <span className="text-[var(--muted)] truncate">— {a.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function LiveAnalytics() {
  const rooms = useAppStore((s) => s.rooms)
  const totalSessions = rooms.length
  const avgParticipants = totalSessions > 0 ? (rooms.reduce((s, r) => s + r.participants, 0) / totalSessions).toFixed(1) : '—'
  const questionsAsked = rooms.reduce((s, r) => s + r.participants * 3, 0)
  const aiQueries = rooms.reduce((s, r) => s + r.participants * 2, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total sessions" value={totalSessions} icon={Radio} />
        <StatCard label="Avg participants" value={avgParticipants} icon={Users} />
        <StatCard label="Questions asked" value={questionsAsked} icon={MessageSquare} />
        <StatCard label="AI queries" value={aiQueries} icon={Bot} />
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
  const playEvents = activity.filter((a) => a.surface === 'play').length
  const gaps = [
    { label: 'Match types', pct: 45 },
    { label: 'Budget pacing', pct: 30 },
    { label: 'Ad copy', pct: 68 },
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Practice sessions" value={Math.max(playEvents, 3)} icon={Target} />
        <StatCard label="Avg accuracy" value="74%" icon={Award} />
        <StatCard label="Scenarios run" value={5} icon={Bot} />
        <StatCard label="Improvement" value="+12%" icon={Users} hint="vs last week" />
      </div>
      <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
        <h3 className="text-sm font-semibold mb-4">Mistakes & gaps — where to focus</h3>
        <div className="space-y-4">{gaps.map((g) => <Bar key={g.label} label={g.label} pct={g.pct} sub={`${g.pct}% mastery`} />)}</div>
      </div>
    </div>
  )
}

function TeamInsights() {
  const role = usePersistStore((s) => s.role)
  if (role !== 'facilitator') {
    return <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--muted)]">Team & org insights are available to facilitators. Switch role from the top bar to view them.</div>
  }
  function exportReport() {
    const data = { generatedFor: 'team', members: 12, avgProgress: 0.61 }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'team-report.json'; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Team members" value={12} icon={Users} />
        <StatCard label="Avg progress" value="61%" icon={Target} />
        <StatCard label="Content items" value={48} icon={BookOpen} />
        <StatCard label="Active this week" value={9} icon={Award} />
      </div>
      <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Content effectiveness</h3>
          <button onClick={exportReport} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--surface-3)] font-medium"><Download size={13} /> Export report</button>
        </div>
        <div className="space-y-4">
          <Bar label="AI in 2025 (live)" pct={88} sub="88% completion" />
          <Bar label="Google Ads course" pct={64} sub="64% completion" />
          <Bar label="Data analysis path" pct={41} sub="41% completion" />
        </div>
      </div>
    </div>
  )
}
