import { Link } from '@tanstack/react-router'
import {
  Radio, BookOpen, Gamepad2, Briefcase, Sparkles, ArrowRight, Clock, Bookmark, TrendingUp,
} from 'lucide-react'
import { usePersistStore } from '../store/persist'
import { SECTIONS } from '../lib/ia'

/**
 * Home dashboard (LLP-113) — the IA root. Role-aware, pulls live data from the
 * persistent layer: continue where you left off, recent activity, quick actions.
 */
export default function Home() {
  const role = usePersistStore((s) => s.role)
  const profile = usePersistStore((s) => s.profile)
  const library = usePersistStore((s) => s.library)
  const projects = usePersistStore((s) => s.projects)
  const activity = usePersistStore((s) => s.activity)

  const recent = library.slice(0, 3)
  const openProjects = projects.slice(0, 3)

  const quickActions = role === 'facilitator'
    ? [
        { label: 'Start a live session', to: '/live', icon: Radio, color: 'indigo' },
        { label: 'Review analytics', to: '/analytics', icon: TrendingUp, color: 'amber' },
        { label: 'New project', to: '/projects', icon: Briefcase, color: 'violet' },
      ]
    : [
        { label: 'Join a live session', to: '/live', icon: Radio, color: 'indigo' },
        { label: 'Ask the assistant', to: '/learn', icon: Sparkles, color: 'emerald' },
        { label: 'Practice in Play', to: '/play', icon: Gamepad2, color: 'violet' },
      ]

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <p className="text-sm text-[var(--muted)]">Welcome back{profile.name && profile.name !== 'Guest' ? `, ${profile.name}` : ''}</p>
        <h1 className="text-2xl font-bold tracking-tight">What do you want to do in the Sandbox?</h1>
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {quickActions.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="group flex items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
              <a.icon size={17} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-sm font-semibold flex-1">{a.label}</span>
            <ArrowRight size={15} className="text-[var(--muted)] group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Continue */}
        <section className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Clock size={15} /> Continue</h2>
              <Link to="/library" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">View library</Link>
            </div>
            <div className="space-y-2">
              {recent.map((i) => (
                <div key={i.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-3)] flex items-center justify-center text-xs font-medium uppercase text-[var(--muted)]">{i.kind[0]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{i.title}</p>
                    <p className="text-xs text-[var(--muted)] capitalize">{i.origin} · {i.kind}</p>
                  </div>
                  {i.bookmarked && <Bookmark size={14} className="text-indigo-500 fill-indigo-500" />}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Briefcase size={15} /> Your projects</h2>
              <Link to="/projects" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">All projects</Link>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              {openProjects.map((p) => {
                const done = p.tasks.filter((t) => t.done).length
                return (
                  <Link key={p.id} to="/projects" className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:shadow-sm transition-shadow">
                    <p className="text-sm font-medium truncate mb-1">{p.name}</p>
                    <p className="text-xs text-[var(--muted)]">{done}/{p.tasks.length} tasks</p>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Activity + explore */}
        <aside className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><BookOpen size={15} /> Explore</h2>
            <div className="space-y-1.5">
              {SECTIONS.map((s) => (
                <Link key={s.id} to={s.path} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--surface-3)] transition-colors">
                  <s.icon size={15} className="text-[var(--muted)]" />
                  <span className="text-sm flex-1">{s.label}</span>
                  <span className="text-xs text-[var(--muted)]">{s.tagline}</span>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3">Recent activity</h2>
            <div className="space-y-2">
              {activity.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span className="text-[var(--muted)]"><span className="capitalize text-[var(--text)]">{a.surface}</span> — {a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
