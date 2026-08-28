import { Link } from '@tanstack/react-router'
import { Radio, BookOpen, Gamepad2, ArrowRight, Brain, Zap, Sparkles, Target, Search, Wrench, Eye } from 'lucide-react'
import ParticleHeadline from '../components/ParticleHeadline'

const START_OPTIONS = [
  {
    icon: Radio,
    label: 'Run a live session',
    desc: 'Host a webinar or workshop with AI-assisted notes, chat and transcript.',
    href: '/live',
    color: 'indigo',
    iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600',
    border: 'border-indigo-200 hover:border-indigo-400', bg: 'hover:bg-indigo-50/40',
  },
  {
    icon: Target,
    label: 'Build a creative workflow',
    desc: 'Use the Sandbox blocks — Goal, Inputs, Insight, Ideas, Make, Present.',
    href: '/live/sandbox-demo',
    color: 'violet',
    iconBg: 'bg-violet-100', iconColor: 'text-violet-600',
    border: 'border-violet-200 hover:border-violet-400', bg: 'hover:bg-violet-50/40',
  },
  {
    icon: Search,
    label: 'Research a topic',
    desc: 'Deep-dive into AI, auditing, law, dentistry, marketing and more.',
    href: '/learn',
    color: 'emerald',
    iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
    border: 'border-emerald-200 hover:border-emerald-400', bg: 'hover:bg-emerald-50/40',
  },
  {
    icon: Wrench,
    label: 'Test an AI tool',
    desc: 'Experiment with prompts, models, and creative scenarios step by step.',
    href: '/play',
    color: 'amber',
    iconBg: 'bg-amber-100', iconColor: 'text-amber-600',
    border: 'border-amber-200 hover:border-amber-400', bg: 'hover:bg-amber-50/40',
  },
  {
    icon: Eye,
    label: 'Review a session',
    desc: 'Browse past sessions, replay transcripts, and extract key decisions.',
    href: '/live',
    color: 'rose',
    iconBg: 'bg-rose-100', iconColor: 'text-rose-600',
    border: 'border-rose-200 hover:border-rose-400', bg: 'hover:bg-rose-50/40',
  },
  {
    icon: Sparkles,
    label: 'Explore the Sandbox',
    desc: 'Jump straight into an open workspace and start building from scratch.',
    href: '/live/open-sandbox',
    color: 'sky',
    iconBg: 'bg-sky-100', iconColor: 'text-sky-600',
    border: 'border-sky-200 hover:border-sky-400', bg: 'hover:bg-sky-50/40',
  },
]

const MODES = [
  {
    tag: '01', title: 'Live', subtitle: 'Engage in real time', icon: Radio, href: '/live',
    accent: 'indigo', desc: 'Host webinars and workshops with AI-assisted Q&A, notes, transcript and live chat.',
    dot: 'bg-indigo-500',
  },
  {
    tag: '02', title: 'Learn', subtitle: 'Build deep knowledge', icon: BookOpen, href: '/learn',
    accent: 'emerald', desc: 'Domain-specific AI with curated knowledge bases across six expert fields.',
    dot: 'bg-emerald-500',
  },
  {
    tag: '03', title: 'Play', subtitle: 'Experiment & discover', icon: Gamepad2, href: '/play',
    accent: 'violet', desc: 'AI mentor for hands-on tool exploration. Learn by doing, step by step.',
    dot: 'bg-violet-500',
  },
]

export default function Landing() {
  return (
    <div className="bg-white min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 pt-16 pb-12 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-xs text-indigo-700 font-medium">Platform live</span>
          </div>
        </div>

        <div className="max-w-[720px] mb-12">
          <ParticleHeadline />
          <p className="text-lg text-[#6B7280] leading-relaxed mt-6">
            A live AI Sandbox where teams learn, build and create together.
          </p>
        </div>

        {/* Start question */}
        <div className="mb-3">
          <p className="text-sm font-semibold text-[#374151]">What do you want to do in the Sandbox?</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-[900px]">
          {START_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <Link key={opt.label} to={opt.href}
                className={`group flex items-start gap-4 p-4 rounded-2xl border bg-white transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${opt.border} ${opt.bg}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${opt.iconBg}`}>
                  <Icon size={17} className={opt.iconColor} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827] leading-tight mb-1">{opt.label}</p>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">{opt.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <div className="border-t border-[#F0F0F5]" />

      {/* ── Modes ─────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 py-12 max-w-[1200px] mx-auto">
        <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-6">Three modes, one platform</p>
        <div className="grid lg:grid-cols-3 gap-4">
          {MODES.map((mode) => {
            const Icon = mode.icon
            const grad = mode.accent === 'indigo' ? 'from-indigo-500 to-indigo-600'
              : mode.accent === 'emerald' ? 'from-emerald-500 to-emerald-600'
              : 'from-violet-500 to-violet-600'
            const linkColor = mode.accent === 'indigo' ? 'text-indigo-500 group-hover:text-indigo-700'
              : mode.accent === 'emerald' ? 'text-emerald-500 group-hover:text-emerald-700'
              : 'text-violet-500 group-hover:text-violet-700'
            return (
              <Link key={mode.tag} to={mode.href}
                className="group flex flex-col p-6 rounded-2xl bg-white border border-[#E8E8EF] hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/60 transition-all duration-300">
                <div className="flex items-start justify-between mb-5">
                  <span className="text-[10px] font-mono text-[#CACAD4] tracking-widest">{mode.tag}</span>
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm`}>
                    <Icon size={17} className="text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-[#111827] tracking-tight">{mode.title}</h3>
                <p className={`text-xs font-medium mt-0.5 mb-4 ${mode.accent === 'indigo' ? 'text-indigo-500' : mode.accent === 'emerald' ? 'text-emerald-500' : 'text-violet-500'}`}>
                  {mode.subtitle}
                </p>
                <p className="text-sm text-[#6B7280] leading-relaxed flex-1">{mode.desc}</p>
                <div className={`flex items-center gap-1.5 text-xs font-semibold mt-5 transition-colors ${linkColor}`}>
                  Open {mode.title}
                  <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── AI layer ─────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 pb-20 max-w-[1200px] mx-auto">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-violet-50 border border-indigo-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-[#111827] flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111827]">Unified AI layer</h3>
              <p className="text-xs text-[#9CA3AF]">One intelligence core powering all three modes simultaneously</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: Brain,    label: 'Reasoning', desc: 'Thinks before answering',  color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
              { icon: Sparkles, label: 'Synthesis',  desc: 'Connects ideas in real time', color: 'text-violet-600',  bg: 'bg-violet-50'  },
              { icon: Target,   label: 'Context',   desc: 'Stays focused on your goal', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map(({ icon: PIcon, label, desc, color, bg }) => (
              <div key={label} className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-[#E8E8EF] shadow-sm">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <PIcon size={16} className={color} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{label}</p>
                  <p className="text-xs text-[#9CA3AF]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
