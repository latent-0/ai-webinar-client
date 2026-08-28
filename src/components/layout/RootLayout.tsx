import { useState, useEffect } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { Zap, Sun, Moon, LogIn, User, Search, Bell, ChevronDown } from 'lucide-react'
import { useAuth } from '../../lib/authClient'
import { ALL_SECTIONS } from '../../lib/ia'
import { usePersistStore } from '../../store/persist'
import CommandPalette from '../CommandPalette'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const path = router.state.location.pathname
  const { auth, signOut } = useAuth()

  const role = usePersistStore((s) => s.role)
  const setRole = usePersistStore((s) => s.setRole)
  const [roleOpen, setRoleOpen] = useState(false)

  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  // Facilitators see every section; learners see all but Admin-heavy nav is gated inside Settings.
  const sections = ALL_SECTIONS.filter((s) => !s.facilitatorOnly || role === 'facilitator')

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <CommandPalette />

      <header className="h-14 sticky top-0 z-50 bg-white/90 dark:bg-[#1A1A1F]/90 backdrop-blur-sm border-b border-[var(--border)] flex items-center px-4 gap-3">
        <Link to="/" className="flex items-center gap-2.5 mr-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={13} className="text-white" />
          </div>
          <span className="text-sm font-bold text-[var(--text)] tracking-tight hidden sm:inline">Sandbox</span>
        </Link>

        <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          {sections.map(({ id, label, path: to, icon: Icon }) => {
            const isActive = id === 'home' ? path === '/home' : path.startsWith(to)
            return (
              <Link
                key={id}
                to={to}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]'
                }`}
              >
                <Icon size={15} />
                <span className="hidden md:inline">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="flex-1" />

        {/* Global search / command palette */}
        <button
          onClick={() => window.dispatchEvent(new Event('sandbox:open-command'))}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
          title="Search (Ctrl/Cmd+K)"
        >
          <Search size={14} />
          <span className="text-xs hidden lg:inline">Search…</span>
          <kbd className="text-[10px] border border-[var(--border)] rounded px-1 hidden lg:inline">⌘K</kbd>
        </button>

        <button className="p-2 rounded-lg hover:bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--text)] transition-colors relative" title="Notifications">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
        </button>

        {/* Role switch (LLP-123) */}
        <div className="relative">
          <button
            onClick={() => setRoleOpen((o) => !o)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--surface-3)] transition-colors"
            title="Switch role"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${role === 'facilitator' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
            <span className="hidden sm:inline capitalize">{role}</span>
            <ChevronDown size={12} />
          </button>
          {roleOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-1 z-50">
              {(['learner', 'facilitator'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => { setRole(r); setRoleOpen(false) }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[var(--surface-3)] ${role === r ? 'text-indigo-600 dark:text-indigo-400 font-medium' : ''}`}
                >
                  <span className="capitalize">{r}</span>
                  <span className="block text-[11px] text-[var(--muted)]">{r === 'learner' ? 'End User' : 'Host / Instructor'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setIsDark((d) => !d)}
          className="p-2 rounded-lg hover:bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {auth?.authenticated ? (
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] text-sm font-medium transition-colors"
            title={auth.email ?? undefined}
          >
            <User size={14} />
            <span className="hidden sm:inline max-w-[100px] truncate">{auth.email}</span>
          </button>
        ) : (
          <Link
            to="/signin"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] text-sm font-medium transition-colors"
          >
            <LogIn size={14} />
            <span className="hidden sm:inline">Sign in</span>
          </Link>
        )}
      </header>

      <main>{children}</main>
    </div>
  )
}
