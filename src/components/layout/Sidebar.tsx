import { Link, useRouter } from '@tanstack/react-router'
import { Radio, BookOpen, Gamepad2, Home, Settings, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/', icon: Home, label: 'Home', color: 'text-white', bar: 'bg-white/60' },
  { to: '/live', icon: Radio, label: 'Live', color: 'text-blue-400', bar: 'bg-blue-500' },
  { to: '/learn', icon: BookOpen, label: 'Learn', color: 'text-emerald-400', bar: 'bg-emerald-500' },
  { to: '/play', icon: Gamepad2, label: 'Play', color: 'text-violet-400', bar: 'bg-violet-500' },
]

export default function Sidebar() {
  const router = useRouter()
  const path = router.state.location.pathname

  return (
    <aside className="w-14 lg:w-52 h-screen bg-[#050509] border-r border-white/[0.05] flex flex-col py-4 shrink-0">
      {/* Logo */}
      <div className="px-3 lg:px-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0">
            <Zap size={13} className="text-white" />
          </div>
          <div className="hidden lg:block leading-none">
            <p className="text-[11px] font-bold tracking-widest text-white uppercase">Sandbox</p>
            <p className="text-[10px] text-[#4A4A5A] mt-0.5 tracking-wide">AI Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label, color, bar }) => {
          const isActive = to === '/' ? path === '/' : path.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative flex items-center gap-2.5 px-2.5 lg:px-3 py-2.5 rounded-xl transition-all text-sm font-medium overflow-hidden',
                isActive
                  ? 'bg-white/[0.06] text-white'
                  : 'text-[#5A5A70] hover:bg-white/[0.03] hover:text-[#BBBBCC]'
              )}
            >
              {isActive && (
                <span className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full', bar)} />
              )}
              <Icon size={16} className={cn('transition-colors shrink-0', isActive ? color : '')} />
              <span className="hidden lg:block">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2">
        <div className="hidden lg:block h-px bg-white/[0.05] mb-2" />
        <button className="flex items-center gap-2.5 px-2.5 lg:px-3 py-2.5 rounded-xl text-[#3A3A50] hover:bg-white/[0.03] hover:text-[#8888AA] transition-all text-sm font-medium w-full">
          <Settings size={16} className="shrink-0" />
          <span className="hidden lg:block">Settings</span>
        </button>
      </div>
    </aside>
  )
}
