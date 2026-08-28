import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import {
  Zap, Share2, Check, Brain,
  Target, FolderOpen, Sparkles, Lightbulb, Package,
  Send, Users, X, ChevronLeft, ChevronRight,
  Mic, MicOff, Video, VideoOff,
  PhoneOff, Radio, Wrench, BookOpen, ExternalLink,
  Cpu, Check as CheckIcon, Crown,
} from 'lucide-react'
import { useAppStore } from '../store'
import { usePersistStore } from '../store/persist'
import { runAgent, TOOLS } from '../lib/agents'
import PollPanel from '../components/PollPanel'
import BreakoutsPanel from '../components/BreakoutsPanel'
import { mediaPermissionNotice, type PermState } from '../lib/media'
import { sendHeartbeat } from '../lib/presenceClient'

interface JitsiParticipant {
  participantId?: string
  id?: string
  displayName?: string
  formattedDisplayName?: string
  role?: string
  roomName?: string
  muted?: boolean
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: Record<string, unknown>) => {
      addEventListeners: (listeners: Record<string, (e: JitsiParticipant) => void>) => void
      executeCommand: (cmd: string, ...args: unknown[]) => void
      getParticipantsInfo?: () => JitsiParticipant[] | Promise<JitsiParticipant[]>
      dispose: () => void
    }
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg  { id: string; user: string; avatar: string; time: string; content: string }
interface AIMsg    { id: string; role: 'user' | 'assistant'; content: string }
/** A person in the room (T-64 / LLP-70). */
interface RosterEntry { id: string; name: string; isLocal: boolean; isHost: boolean }

// ─── Sandbox blocks ───────────────────────────────────────────────────────────

const BLOCKS = [
  { id: 'goal',    title: 'Goal',    subtitle: 'What are we building?',    icon: Target,      color: 'indigo',  placeholder: 'What are we trying to make, learn, or solve in this session?',     hint: 'Help me define a clear, actionable goal for this session.' },
  { id: 'inputs',  title: 'Inputs',  subtitle: 'Context & materials',      icon: FolderOpen,  color: 'sky',     placeholder: 'Paste links, notes, transcripts, or any context here…',           hint: 'Analyse these inputs and identify the key themes and signals.' },
  { id: 'insight', title: 'Insight', subtitle: 'What AI has found',        icon: Sparkles,    color: 'violet',  placeholder: 'Key insights from the session will appear here…',                  hint: 'What are the most important insights from this session so far?' },
  { id: 'ideas',   title: 'Ideas',   subtitle: 'Concepts & directions',    icon: Lightbulb,   color: 'amber',   placeholder: 'Concepts, routes, and creative directions…',                      hint: 'Generate three creative directions based on the goal and insights.' },
  { id: 'make',    title: 'Make',    subtitle: 'Prompts & generation',     icon: Zap,         color: 'emerald', placeholder: 'Prompts, experiments, and generated outputs…',                     hint: 'Help me craft an effective prompt for this concept.' },
  { id: 'present', title: 'Present', subtitle: 'Outputs & sharing',        icon: Package,     color: 'rose',    placeholder: 'Final outputs, summaries, and export links…',                     hint: 'Summarise the session outputs into a clear, shareable format.' },
] as const

type BlockId = typeof BLOCKS[number]['id']

const COLORS: Record<string, { bg: string; border: string; activeBorder: string; iconBg: string; iconColor: string; dot: string; tag: string }> = {
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  activeBorder: 'border-indigo-400',  iconBg: 'bg-indigo-100',  iconColor: 'text-indigo-600',  dot: 'bg-indigo-400',  tag: 'bg-indigo-100 text-indigo-600 border-indigo-200'  },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-200',     activeBorder: 'border-sky-400',     iconBg: 'bg-sky-100',     iconColor: 'text-sky-600',     dot: 'bg-sky-400',     tag: 'bg-sky-100 text-sky-600 border-sky-200'           },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  activeBorder: 'border-violet-400',  iconBg: 'bg-violet-100',  iconColor: 'text-violet-600',  dot: 'bg-violet-400',  tag: 'bg-violet-100 text-violet-600 border-violet-200'  },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   activeBorder: 'border-amber-400',   iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   dot: 'bg-amber-400',   tag: 'bg-amber-100 text-amber-600 border-amber-200'     },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', activeBorder: 'border-emerald-400', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', dot: 'bg-emerald-400', tag: 'bg-emerald-100 text-emerald-600 border-emerald-200'},
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    activeBorder: 'border-rose-400',    iconBg: 'bg-rose-100',    iconColor: 'text-rose-600',    dot: 'bg-rose-400',    tag: 'bg-rose-100 text-rose-600 border-rose-200'        },
}

// ─── Static data ──────────────────────────────────────────────────────────────

const INIT_CHAT: ChatMsg[] = [
  { id: '1', user: 'Sophie', avatar: 'S', time: '10:34 AM', content: 'This workflow is 🔥' },
  { id: '2', user: 'Alex',   avatar: 'A', time: '10:34 AM', content: 'Can you show the prompt again?' },
  { id: '3', user: 'Jordan', avatar: 'J', time: '10:35 AM', content: 'Loving the Sandbox!' },
]

const AVATAR_COLORS: Record<string, string> = { S: 'bg-rose-500', A: 'bg-indigo-500', J: 'bg-emerald-500', T: 'bg-amber-500' }

const SESSION_NOTES = [
  'Clear goals unlock better AI outputs.',
  'More context in Inputs means richer Insights.',
  'Iterate with small changes, not big jumps.',
  'Test across models for different results.',
  'Keep human judgement in the loop.',
  'Present your thinking — output shapes the next goal.',
]

const SOURCES = [
  { title: 'AI Workflow Design Patterns', domain: 'arxiv.org' },
  { title: 'Prompt Engineering Guide', domain: 'promptingguide.ai' },
  { title: 'Midjourney V6 Docs', domain: 'midjourney.com' },
  { title: 'Creative Process Frameworks', domain: 'ideo.com' },
]

const PROMPT_LIBRARY = [
  { label: 'Cinematic portrait', prompt: 'Ultra-realistic cinematic portrait, golden hour lighting, shallow depth of field, 85mm lens' },
  { label: 'Abstract tech',      prompt: 'Abstract technology visualization, neural network nodes, glowing edges, dark background, 8k' },
  { label: 'Product hero',       prompt: 'Luxury product hero shot, studio lighting, white background, reflective surface' },
  { label: 'Sci-fi landscape',   prompt: 'Epic sci-fi landscape, distant planets, alien flora, volumetric fog, concept art style' },
]

const BUILD_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', badge: 'Fast' },
  { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   badge: 'Smart' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', badge: 'Stable' },
]

const BUILD_TOOLS = [
  { id: 'web_search', label: 'Web Search',        desc: 'Search the web for current info',      enabled: true  },
  { id: 'code_exec',  label: 'Code Execution',    desc: 'Run code and return output',            enabled: false },
  { id: 'image_gen',  label: 'Image Generation',  desc: 'Generate images from prompts',          enabled: true  },
  { id: 'doc_parse',  label: 'Document Parser',   desc: 'Extract info from docs and PDFs',       enabled: false },
]

function estimateTokens(...texts: string[]) {
  return Math.ceil(texts.join('').length / 4)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Workspace() {
  const { roomId } = useParams({ from: '/live/$roomId' })
  const navigate    = useNavigate()
  const { displayName, rooms, updateRoomTokens } = useAppStore()
  const room = rooms.find(r => r.id === roomId)

  // ── Sandbox blocks
  const [expandedBlock, setExpandedBlock] = useState<BlockId | null>(null)
  const [blockContent, setBlockContent]   = useState<Record<string, string>>({})

  // ── Panel state
  const [liveCollapsed, setLiveCollapsed]           = useState(false)
  const [assistantCollapsed, setAssistantCollapsed] = useState(false)
  const [assistantTab, setAssistantTab]             = useState<'chat' | 'notes' | 'sources'>('chat')
  const [buildOpen, setBuildOpen]                   = useState(false)

  // ── Chat (Live panel)
  const [chatMsgs, setChatMsgs]   = useState<ChatMsg[]>(INIT_CHAT)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // ── Assistant (right panel)
  const [assistantMsgs, setAssistantMsgs]       = useState<AIMsg[]>([])
  const [assistantInput, setAssistantInput]     = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)

  // ── Transcript (notes tab)
  const [transcript, setTranscript]             = useState<string | null>(null)
  const [transcriptLoading, setTranscriptLoading] = useState(false)

  // ── Build mode
  const [buildTab, setBuildTab]         = useState<'api' | 'prompts' | 'models' | 'tools'>('api')
  const [apiBody, setApiBody]           = useState('{\n  "prompt": "Futuristic race car, motion blur, cinematic",\n  "style": "cinematic",\n  "ar": "16:9"\n}')
  const [apiLoading, setApiLoading]     = useState(false)
  const [apiResponse, setApiResponse]   = useState<string | null>(null)
  const [activeModel, setActiveModel]   = useState('gemini-2.5-flash')
  const [enabledTools, setEnabledTools] = useState(['web_search', 'image_gen'])

  // ── Misc
  const [copied, setCopied]                   = useState(false)
  const [jitsiLoaded, setJitsiLoaded]         = useState(false)
  const [participants, setParticipants]       = useState<RosterEntry[]>([])
  const [rosterOpen, setRosterOpen]           = useState(false)
  const [micMuted, setMicMuted]               = useState(true)
  const [camMuted, setCamMuted]               = useState(false)
  const [mediaNotice, setMediaNotice]         = useState<string | null>(null)
  const [noticeDismissed, setNoticeDismissed] = useState(false)

  const canLaunchPolls = usePersistStore((s) => s.role) === 'facilitator'
  const hostName = room?.host
  const participantCount = Math.max(1, participants.length)
  const hostEntry = participants.find((p) => p.isHost)

  const jitsiContainerRef = useRef<HTMLDivElement>(null)
  const jitsiApiRef       = useRef<InstanceType<typeof window.JitsiMeetExternalAPI> | null>(null)
  const localIdRef        = useRef<string | null>(null)
  const chatEndRef        = useRef<HTMLDivElement>(null)
  const assistantEndRef   = useRef<HTMLDivElement>(null)

  const activeBlock = expandedBlock ? BLOCKS.find(b => b.id === expandedBlock) : null

  // ── Scroll to bottom
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMsgs])
  useEffect(() => { assistantEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [assistantMsgs])

  // ── Reset assistant messages when block changes
  useEffect(() => { setAssistantMsgs([]) }, [expandedBlock])

  // ── Load Jitsi
  useEffect(() => {
    if (document.getElementById('jitsi-api-script')) { setJitsiLoaded(true); return }
    const s = document.createElement('script')
    s.id = 'jitsi-api-script'
    s.src = 'https://meet.jit.si/external_api.js'
    s.async = true
    s.onload = () => setJitsiLoaded(true)
    document.body.appendChild(s)
  }, [])

  // ── Init Jitsi
  useEffect(() => {
    if (!jitsiLoaded || !jitsiContainerRef.current) return
    if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); jitsiApiRef.current = null }
    const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: `sandbox-live-${roomId}`,
      parentNode: jitsiContainerRef.current,
      width: '100%', height: '100%',
      userInfo: { displayName: displayName || 'Guest', email: '' },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        toolbarButtons: [],
      },
      interfaceConfigOverwrite: {
        MOBILE_APP_PROMO: false,
        SHOW_CHROME_EXTENSION_BANNER: false,
        FILM_STRIP_MAX_HEIGHT: 60,
      },
    })
    // Presence + host identification (T-64 / LLP-70). Rebuild the roster from
    // Jitsi every 2s so the list is accurate within 2s of any change, with
    // event listeners making it feel instant in between.
    const isHostOf = (name: string, role?: string) =>
      role === 'moderator' || (!!hostName && name.toLowerCase() === hostName.toLowerCase())

    async function reconcile() {
      const current = jitsiApiRef.current
      if (!current?.getParticipantsInfo) return
      let info: JitsiParticipant[] = []
      try { info = (await current.getParticipantsInfo()) || [] } catch { return }
      const localId = localIdRef.current
      const byId = new Map<string, RosterEntry>()
      if (localId) {
        const name = displayName || 'You'
        byId.set(localId, { id: localId, name, isLocal: true, isHost: isHostOf(name) })
      }
      for (const p of info) {
        const id = p.participantId || p.id
        if (!id) continue
        const name = p.displayName || p.formattedDisplayName || 'Guest'
        byId.set(id, { id, name, isLocal: id === localId, isHost: isHostOf(name, p.role) })
      }
      setParticipants(Array.from(byId.values()))
    }

    api.addEventListeners({
      videoConferenceJoined: (e) => { localIdRef.current = e.participantId || e.id || null; reconcile() },
      participantJoined: () => reconcile(),
      participantLeft:   () => reconcile(),
      participantRoleChanged: () => reconcile(),
      displayNameChange: () => reconcile(),
      // Keep the mic/cam buttons honest — reflect Jitsi's real state, so a
      // camera that never started (permission denied) shows as off (LLP-76).
      audioMuteStatusChanged: (e) => { if (typeof e?.muted === 'boolean') setMicMuted(e.muted) },
      videoMuteStatusChanged: (e) => { if (typeof e?.muted === 'boolean') setCamMuted(e.muted) },
    })
    jitsiApiRef.current = api
    const timer = setInterval(reconcile, 2000)
    return () => {
      clearInterval(timer)
      api.dispose()
      jitsiApiRef.current = null
      localIdRef.current = null
      setParticipants([])
    }
  }, [jitsiLoaded, roomId, displayName, hostName]) // eslint-disable-line react-hooks/exhaustive-deps

  // Presence heartbeat (LLP-82 / T-76) so the facilitator monitor grid can see
  // who is in this room and how active it is. Best-effort; silent if presence
  // is not configured.
  useEffect(() => {
    const label = displayName || 'You'
    void sendHeartbeat(roomId, label)
    const t = setInterval(() => { void sendHeartbeat(roomId, label) }, 10_000)
    return () => clearInterval(t)
  }, [roomId, displayName])

  // Graceful media-permission handling (LLP-76 / T-70). If the browser reports
  // camera/mic as blocked, surface a dismissible notice; the session stays
  // fully usable (watch + chat) regardless. Best-effort: the Permissions API
  // is not available everywhere, in which case we defer to Jitsi's own UI.
  useEffect(() => {
    let cancelled = false
    const perms = navigator.permissions
    if (!perms?.query) return
    const status: PermissionStatus[] = []
    const update = (cam: PermState, mic: PermState) => {
      if (!cancelled) setMediaNotice(mediaPermissionNotice(cam, mic))
    }
    Promise.all([
      perms.query({ name: 'camera' as PermissionName }).catch(() => undefined),
      perms.query({ name: 'microphone' as PermissionName }).catch(() => undefined),
    ]).then(([cam, mic]) => {
      if (cancelled) return
      update(cam?.state, mic?.state)
      for (const s of [cam, mic]) {
        if (!s) continue
        status.push(s)
        s.onchange = () => update(cam?.state, mic?.state)
      }
    })
    return () => {
      cancelled = true
      for (const s of status) s.onchange = null
    }
  }, [])

  // ── Handlers
  const sendChat = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return
    if (room && room.tokenUsage >= room.tokenCeiling) {
      setChatMsgs(m => [...m, { id: Date.now().toString(), user: 'AI', avatar: 'AI', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), content: 'Token budget reached for this session. AI assistance is unavailable.' }])
      return
    }
    const text = chatInput.trim(); setChatInput('')
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setChatMsgs(m => [...m, { id: Date.now().toString(), user: displayName || 'You', avatar: (displayName || 'Y')[0].toUpperCase(), time: now, content: text }])
    setChatLoading(true)
    const ctx = 'You are a helpful assistant in a live session. Be concise.'
    try {
      const { answer: reply } = await runAgent('live', text)
      setChatMsgs(m => [...m, { id: (Date.now() + 1).toString(), user: 'AI', avatar: 'AI', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), content: reply }])
      updateRoomTokens(roomId, estimateTokens(text, ctx, reply))
    } finally { setChatLoading(false) }
  }, [chatInput, chatLoading, displayName, room, roomId, updateRoomTokens])

  const sendAssistant = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assistantInput.trim() || assistantLoading) return
    if (room && room.tokenUsage >= room.tokenCeiling) {
      setAssistantMsgs(m => [...m, { id: Date.now().toString(), role: 'assistant', content: 'Token budget reached for this session. AI assistance is unavailable.' }])
      return
    }
    const q = assistantInput.trim(); setAssistantInput('')
    setAssistantMsgs(m => [...m, { id: Date.now().toString(), role: 'user', content: q }])
    setAssistantLoading(true)
    try {
      const context = activeBlock
        ? `You are helping with the "${activeBlock.title}" block of a live Sandbox session. ${activeBlock.hint}`
        : 'You are an AI assistant in a live creative Sandbox session.'
      const { answer: ans } = await runAgent('sandbox', q, { extraContext: context })
      setAssistantMsgs(m => [...m, { id: (Date.now() + 1).toString(), role: 'assistant', content: ans }])
      updateRoomTokens(roomId, estimateTokens(q, context, ans))
    } finally { setAssistantLoading(false) }
  }, [assistantInput, assistantLoading, activeBlock, room, roomId, updateRoomTokens])

  const sendPlayground = useCallback(async () => {
    if (apiLoading) return
    setApiLoading(true); setApiResponse(null)
    try {
      let prompt = 'Generate creative content'
      try { const p = JSON.parse(apiBody); if (p.prompt) prompt = p.prompt } catch {}
      const ctx = 'You are a creative AI. Generate vivid, descriptive content based on the prompt.'
      const { answer: resp } = await runAgent('sandbox', prompt, { extraContext: ctx, skipRetrieval: true })
      setApiResponse(resp)
      updateRoomTokens(roomId, estimateTokens(prompt, ctx, resp))
    } finally { setApiLoading(false) }
  }, [apiBody, apiLoading, roomId, updateRoomTokens])

  async function generateTranscript() {
    if (transcriptLoading) return
    setTranscriptLoading(true)
    try {
      const prompt = `Generate a realistic 5-minute webinar transcript excerpt for room "${roomId}". Include speaker names (Host, Sophie, Alex), timestamps, and natural conversation.`
      const ctx = 'You are a transcript generator. Output clean, realistic transcript text with timestamps in [MM:SS] format.'
      const { answer: t } = await TOOLS.transcript.run(prompt)
      setTranscript(t)
      updateRoomTokens(roomId, estimateTokens(prompt, ctx, t))
    } finally { setTranscriptLoading(false) }
  }

  async function shareRoom() {
    await navigator.clipboard.writeText(`${window.location.origin}/live/${roomId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function toggleMic() { jitsiApiRef.current?.executeCommand('toggleAudio'); setMicMuted(m => !m) }
  function toggleCam() { jitsiApiRef.current?.executeCommand('toggleVideo'); setCamMuted(c => !c) }
  function hangUp()    { jitsiApiRef.current?.executeCommand('hangup'); navigate({ to: '/live' }) }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F7F7FA] text-[#111827]">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header className="h-12 bg-white border-b border-[#E8E8EF] flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#111827] flex items-center justify-center">
            <Zap size={13} className="text-white" />
          </div>
          <span className="text-sm font-bold">Sandbox</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs text-[#6B7280] font-medium truncate max-w-[160px]">{roomId}</span>
          {hostEntry && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-[#9CA3AF]">
              <Crown size={9} className="text-amber-500" /> {hostEntry.name}{hostEntry.isLocal ? ' (you)' : ''}
            </span>
          )}
          <div className="relative">
            <button
              onClick={() => setRosterOpen(o => !o)}
              title="Participants"
              className="flex items-center gap-1 text-[10px] text-[#9CA3AF] px-2 py-0.5 rounded-full bg-[#F7F7FA] border border-[#E8E8EF] hover:text-[#374151]"
            >
              <Users size={9} /> {participantCount}
            </button>
            {rosterOpen && (
              <div className="absolute left-0 mt-2 w-56 max-h-72 overflow-y-auto rounded-xl bg-white border border-[#E8E8EF] shadow-lg z-[60] py-1">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[#9CA3AF] border-b border-[#E8E8EF]">
                  In the room · {participantCount}
                </div>
                {participants.length === 0 && <div className="px-3 py-2 text-[11px] text-[#9CA3AF]">Connecting…</div>}
                {participants
                  .slice()
                  .sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.name.localeCompare(b.name))
                  .map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#374151]">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold shrink-0">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate flex-1">{p.name}{p.isLocal ? ' (you)' : ''}</span>
                      {p.isHost && <Crown size={11} className="text-amber-500 shrink-0" />}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1" />

        {room && room.tokenUsage >= room.tokenCeiling * 0.8 && (
          <span className={`text-[10px] font-medium px-2 py-1 rounded-full border ${room.tokenUsage >= room.tokenCeiling ? 'bg-red-50 border-red-200 text-red-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
            {room.tokenUsage >= room.tokenCeiling ? 'Token limit reached' : 'Token budget low'}
          </span>
        )}

        <button onClick={shareRoom} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[#F7F7FA] text-sm font-medium text-[#374151] transition-colors">
          {copied ? <Check size={13} className="text-emerald-500" /> : <Share2 size={13} />}
          {copied ? 'Copied!' : 'Share'}
        </button>

        <button onClick={() => setBuildOpen(true)} title="Build mode"
          className="p-2 rounded-lg hover:bg-[#F7F7FA] text-[#9CA3AF] hover:text-[#374151] transition-colors">
          <Wrench size={14} />
        </button>

        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer select-none">
          {(displayName || 'U')[0].toUpperCase()}
        </div>

        <button onClick={() => navigate({ to: '/live' })} className="p-1.5 rounded-lg hover:bg-red-50 text-[#9CA3AF] hover:text-red-400 transition-colors ml-1">
          <X size={14} />
        </button>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: Live ─────────────────────────────────────────────────────── */}
        <div className={`flex flex-col bg-white border-r border-[#E8E8EF] shrink-0 transition-all duration-300 overflow-hidden ${liveCollapsed ? 'w-11' : 'w-72'}`}>
          {liveCollapsed ? (
            <button onClick={() => setLiveCollapsed(false)}
              className="flex-1 flex flex-col items-center justify-center gap-2 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F7F7FA] transition-colors">
              <Radio size={14} />
              <ChevronRight size={10} />
            </button>
          ) : (
            <>
              {/* Live header */}
              <div className="px-3 py-2.5 border-b border-[#E8E8EF] flex items-center gap-2 shrink-0">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
                </span>
                <span className="text-xs font-semibold text-[#111827] flex-1">Live</span>
                <span className="flex items-center gap-1 text-[10px] text-[#9CA3AF]"><Users size={9} /> {participantCount}</span>
                <button onClick={() => setLiveCollapsed(true)} className="p-1 rounded hover:bg-[#F7F7FA] text-[#9CA3AF] transition-colors">
                  <ChevronLeft size={12} />
                </button>
              </div>

              {/* Video */}
              <div className="bg-[#0f0f13] relative shrink-0 overflow-hidden" style={{ height: 180 }}>
                <div ref={jitsiContainerRef} className="absolute inset-0" />
                {!jitsiLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-[9px] text-white/40">Connecting…</p>
                    </div>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold pointer-events-none">
                  <Radio size={8} /> LIVE
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 p-2 bg-gradient-to-t from-black/60 to-transparent">
                  <button onClick={toggleMic} title={micMuted ? 'Unmute' : 'Mute'}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${micMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}>
                    {micMuted ? <MicOff size={12} className="text-white" /> : <Mic size={12} className="text-white" />}
                  </button>
                  <button onClick={toggleCam} title={camMuted ? 'Start video' : 'Stop video'}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${camMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}>
                    {camMuted ? <VideoOff size={12} className="text-white" /> : <Video size={12} className="text-white" />}
                  </button>
                  <button onClick={hangUp} title="Leave" className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors">
                    <PhoneOff size={12} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Graceful media-permission notice (T-70 / LLP-76) */}
              {mediaNotice && !noticeDismissed && (
                <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-800 shrink-0">
                  <VideoOff size={12} className="mt-0.5 shrink-0" />
                  <span className="flex-1 leading-snug">{mediaNotice}</span>
                  <button onClick={() => setNoticeDismissed(true)} className="shrink-0 text-amber-500 hover:text-amber-700" title="Dismiss">
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Live poll (T-68 / LLP-74) + Breakouts (T-74 / LLP-80) */}
              <div className="px-3 py-2 border-b border-[#E8E8EF] shrink-0 space-y-2 empty:hidden [&:not(:has(>*))]:hidden">
                <PollPanel roomId={roomId} canLaunch={canLaunchPolls} />
                <BreakoutsPanel
                  roomId={roomId}
                  canLaunch={canLaunchPolls}
                  participantNames={participants.map((p) => p.name)}
                  myName={displayName || 'You'}
                />
              </div>

              {/* Chat */}
              <div className="flex flex-col flex-1 min-h-0">
                <div className="px-3 py-2 border-b border-[#E8E8EF] flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-[#111827] flex-1">Chat</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
                  {chatMsgs.map(msg => (
                    <div key={msg.id} className="flex items-start gap-2">
                      {msg.avatar === 'AI' ? (
                        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <Brain size={10} className="text-indigo-600" />
                        </div>
                      ) : (
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white ${AVATAR_COLORS[msg.avatar] || 'bg-gray-400'}`}>
                          {msg.avatar}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-[11px] font-semibold text-[#374151]">{msg.user}</span>
                          <span className="text-[9px] text-[#9CA3AF]">{msg.time}</span>
                        </div>
                        <p className="text-[11px] text-[#6B7280] leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <Brain size={10} className="text-indigo-600" />
                      </div>
                      <div className="flex gap-1">{[0, 150, 300].map(d => <span key={d} className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={sendChat} className="px-3 py-2 border-t border-[#E8E8EF] flex items-center gap-2 shrink-0">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Say something…"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#F7F7FA] border border-[#E8E8EF] text-[11px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-indigo-300" />
                  <button type="submit" disabled={!chatInput.trim() || chatLoading}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors">
                    <Send size={12} />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* ── Centre: Sandbox ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {expandedBlock ? (
            // Expanded block view
            (() => {
              const block = BLOCKS.find(b => b.id === expandedBlock)!
              const Icon  = block.icon
              const c     = COLORS[block.color]
              return (
                <div className="flex flex-col h-full">
                  {/* Block header */}
                  <div className="px-6 py-4 bg-white border-b border-[#E8E8EF] flex items-center gap-3 shrink-0">
                    <button onClick={() => setExpandedBlock(null)}
                      className="p-1.5 rounded-lg hover:bg-[#F7F7FA] text-[#9CA3AF] hover:text-[#374151] transition-colors">
                      <X size={14} />
                    </button>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.iconBg}`}>
                      <Icon size={17} className={c.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-bold text-[#111827]">{block.title}</h2>
                      <p className="text-xs text-[#9CA3AF]">{block.subtitle}</p>
                    </div>
                    <button
                      onClick={() => { setAssistantInput(block.hint); setAssistantCollapsed(false); setAssistantTab('chat') }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-medium transition-colors">
                      <Sparkles size={11} /> Ask AI
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-6 min-h-0 overflow-auto">
                    <textarea
                      value={blockContent[expandedBlock] || ''}
                      onChange={e => setBlockContent(prev => ({ ...prev, [expandedBlock]: e.target.value }))}
                      placeholder={block.placeholder}
                      className="w-full h-full min-h-48 p-5 rounded-2xl border border-[#E8E8EF] bg-white text-sm text-[#374151] leading-relaxed resize-none focus:outline-none focus:border-indigo-300 placeholder-[#D1D5DB] shadow-sm"
                    />
                  </div>

                  {/* Mini blocks strip */}
                  <div className="h-16 bg-white border-t border-[#E8E8EF] flex items-center gap-2 px-6 overflow-x-auto shrink-0">
                    <span className="text-[10px] text-[#9CA3AF] font-medium shrink-0 mr-1">Jump to:</span>
                    {BLOCKS.filter(b => b.id !== expandedBlock).map(b => {
                      const BIcon = b.icon
                      const bc = COLORS[b.color]
                      return (
                        <button key={b.id} onClick={() => setExpandedBlock(b.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shrink-0 transition-all hover:shadow-sm ${bc.bg} ${bc.border}`}>
                          <BIcon size={11} className={bc.iconColor} />
                          <span className="text-[11px] font-medium text-[#374151]">{b.title}</span>
                          {blockContent[b.id] && <span className={`w-1.5 h-1.5 rounded-full ${bc.dot} shrink-0`} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()
          ) : (
            // Grid view
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-8 py-10">
                <div className="mb-8">
                  <p className="text-xs text-[#9CA3AF] font-medium mb-1">{roomId}</p>
                  <h1 className="text-2xl font-bold text-[#111827]">Sandbox</h1>
                  <p className="text-sm text-[#9CA3AF] mt-1">Select a block to start building</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {BLOCKS.map(block => {
                    const Icon = block.icon
                    const c = COLORS[block.color]
                    const hasContent = !!blockContent[block.id]
                    return (
                      <button key={block.id} onClick={() => setExpandedBlock(block.id)}
                        className={`group relative p-5 rounded-2xl border-2 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${c.bg} ${hasContent ? c.activeBorder : c.border}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${c.iconBg}`}>
                            <Icon size={18} className={c.iconColor} />
                          </div>
                          {hasContent && <div className={`w-2 h-2 rounded-full ${c.dot} mt-1`} />}
                        </div>
                        <p className="text-sm font-bold text-[#111827] mb-1">{block.title}</p>
                        <p className="text-xs text-[#9CA3AF]">{block.subtitle}</p>
                        {hasContent && (
                          <p className="text-[11px] text-[#6B7280] mt-3 leading-relaxed line-clamp-2">{blockContent[block.id]}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Assistant ─────────────────────────────────────────────────── */}
        <div className={`flex flex-col bg-white border-l border-[#E8E8EF] shrink-0 transition-all duration-300 overflow-hidden ${assistantCollapsed ? 'w-11' : 'w-80'}`}>
          {assistantCollapsed ? (
            <button onClick={() => setAssistantCollapsed(false)}
              className="flex-1 flex flex-col items-center justify-center gap-2 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F7F7FA] transition-colors">
              <Brain size={14} />
              <ChevronLeft size={10} />
            </button>
          ) : (
            <>
              {/* Assistant header */}
              <div className="px-4 py-3 border-b border-[#E8E8EF] flex items-center gap-2 shrink-0">
                <Brain size={15} className="text-indigo-600 shrink-0" />
                <span className="text-sm font-semibold text-[#111827] flex-1">Assistant</span>
                {activeBlock && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${COLORS[activeBlock.color].tag}`}>
                    {activeBlock.title}
                  </span>
                )}
                <button onClick={() => setAssistantCollapsed(true)} className="p-1 rounded hover:bg-[#F7F7FA] text-[#9CA3AF] transition-colors">
                  <ChevronRight size={12} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[#E8E8EF] px-4 shrink-0">
                {(['chat', 'notes', 'sources'] as const).map(tab => (
                  <button key={tab} onClick={() => setAssistantTab(tab)}
                    className={`px-3 py-2 text-xs font-medium transition-colors relative ${assistantTab === tab ? 'text-indigo-600' : 'text-[#9CA3AF] hover:text-[#6B7280]'}`}>
                    {tab === 'chat' ? 'Chat' : tab === 'notes' ? 'Notes' : 'Sources'}
                    {assistantTab === tab && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600 rounded-t-full" />}
                  </button>
                ))}
              </div>

              {/* Chat tab */}
              {assistantTab === 'chat' && (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                    {expandedBlock && assistantMsgs.length === 0 && activeBlock && (
                      <div className={`p-3 rounded-xl border ${COLORS[activeBlock.color].border} ${COLORS[activeBlock.color].bg}`}>
                        <p className={`text-[11px] font-semibold mb-1 ${COLORS[activeBlock.color].iconColor}`}>{activeBlock.title}</p>
                        <p className="text-xs text-[#6B7280] leading-relaxed mb-2">{activeBlock.hint}</p>
                        <button onClick={() => setAssistantInput(activeBlock.hint)}
                          className={`text-[11px] font-medium hover:underline ${COLORS[activeBlock.color].iconColor}`}>
                          Ask this →
                        </button>
                      </div>
                    )}
                    {!expandedBlock && assistantMsgs.length === 0 && (
                      <div className="text-center py-8">
                        <Brain size={28} className="text-[#E8E8EF] mx-auto mb-3" />
                        <p className="text-xs text-[#9CA3AF] leading-relaxed">Select a Sandbox block to get contextual help, or ask me anything.</p>
                      </div>
                    )}
                    {assistantMsgs.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mr-2 shrink-0 mt-0.5">
                            <Brain size={11} className="text-indigo-600" />
                          </div>
                        )}
                        <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                          msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-[#F7F7FA] border border-[#E8E8EF] text-[#374151]'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {assistantLoading && (
                      <div className="flex gap-1 px-3 py-2.5 w-fit rounded-xl bg-[#F7F7FA] border border-[#E8E8EF]">
                        {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                      </div>
                    )}
                    <div ref={assistantEndRef} />
                  </div>
                  <form onSubmit={sendAssistant} className="p-3 border-t border-[#E8E8EF] shrink-0">
                    <div className="flex gap-2">
                      <input value={assistantInput} onChange={e => setAssistantInput(e.target.value)}
                        placeholder={activeBlock ? `Ask about ${activeBlock.title.toLowerCase()}…` : 'Ask anything…'}
                        className="flex-1 px-3 py-2 rounded-lg bg-[#F7F7FA] border border-[#E8E8EF] text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-indigo-400" />
                      <button type="submit" disabled={!assistantInput.trim() || assistantLoading}
                        className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-600 transition-colors">
                        <Send size={13} />
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* Notes tab */}
              {assistantTab === 'notes' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  <div>
                    <p className="text-xs font-semibold text-[#374151] mb-2">Key takeaways</p>
                    <ul className="space-y-1.5">
                      {SESSION_NOTES.map(note => (
                        <li key={note} className="flex items-start gap-2 text-xs text-[#6B7280]">
                          <span className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0" />{note}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-t border-[#E8E8EF] pt-4">
                    <p className="text-xs font-semibold text-[#374151] mb-2">Transcript</p>
                    {!transcript && !transcriptLoading && (
                      <button onClick={generateTranscript}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F7F7FA] border border-[#E8E8EF] text-xs text-[#374151] hover:border-indigo-200 hover:text-indigo-600 transition-colors w-full justify-center">
                        <Sparkles size={11} /> Generate transcript
                      </button>
                    )}
                    {transcriptLoading && (
                      <div className="flex gap-1 justify-center py-2">
                        {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                      </div>
                    )}
                    {transcript && (
                      <div className="text-[11px] text-[#374151] leading-relaxed whitespace-pre-line font-mono bg-[#F7F7FA] rounded-xl p-3 border border-[#E8E8EF]">{transcript}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Sources tab */}
              {assistantTab === 'sources' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-3">Referenced this session</p>
                  {SOURCES.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-[#E8E8EF] hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors cursor-pointer group">
                      <BookOpen size={12} className="text-[#9CA3AF] group-hover:text-indigo-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#374151] leading-tight">{s.title}</p>
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5">{s.domain}</p>
                      </div>
                      <ExternalLink size={10} className="text-[#D1D5DB] group-hover:text-indigo-400 shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Build mode overlay ──────────────────────────────────────────────────── */}
      {buildOpen && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col">
          <div className="h-12 border-b border-[#E8E8EF] flex items-center px-4 gap-3 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#111827] flex items-center justify-center">
              <Wrench size={13} className="text-white" />
            </div>
            <span className="text-sm font-bold">Build</span>
            <span className="text-xs text-[#9CA3AF] px-2 py-1 rounded-full bg-[#F7F7FA] border border-[#E8E8EF]">API Playground</span>
            <div className="flex-1" />
            <button onClick={() => setBuildOpen(false)} className="p-1.5 rounded-lg hover:bg-[#F7F7FA] text-[#9CA3AF] hover:text-[#374151] transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="flex border-b border-[#E8E8EF] px-6 shrink-0">
            {(['api', 'prompts', 'models', 'tools'] as const).map(tab => (
              <button key={tab} onClick={() => setBuildTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative capitalize ${buildTab === tab ? 'text-[#111827]' : 'text-[#9CA3AF] hover:text-[#6B7280]'}`}>
                {tab}
                {buildTab === tab && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#111827] rounded-t-full" />}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-8 min-h-0">
            <div className="max-w-2xl mx-auto space-y-4">
              {buildTab === 'api' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0">POST</span>
                    <input readOnly value="/v1/generate"
                      className="flex-1 px-3 py-2 rounded-lg border border-[#E8E8EF] bg-[#F7F7FA] text-sm text-[#374151] font-mono focus:outline-none min-w-0" />
                    <button onClick={sendPlayground} disabled={apiLoading}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors shrink-0">
                      {apiLoading ? '…' : 'Send'}
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Body</p>
                    <textarea value={apiBody} onChange={e => setApiBody(e.target.value)} rows={6}
                      className="w-full px-4 py-3 rounded-xl border border-[#E8E8EF] bg-[#F7F7FA] text-sm text-[#374151] font-mono focus:outline-none focus:border-indigo-300 resize-none" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Response</p>
                    {apiLoading ? (
                      <div className="flex gap-1 p-4">{[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
                    ) : apiResponse ? (
                      <div className="p-4 rounded-xl bg-[#F7F7FA] border border-[#E8E8EF] text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{apiResponse}</div>
                    ) : (
                      <div className="flex gap-3">
                        {['radial-gradient(ellipse at 40% 40%,#1e3a5f,#0a0a0a)', 'radial-gradient(ellipse at 60% 40%,#2d1b69,#0a0a0a)', 'radial-gradient(ellipse at 50% 60%,#1a2e1a,#0a0a0a)'].map((g, i) => (
                          <div key={i} className="flex-1 h-20 rounded-xl" style={{ background: g }} />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              {buildTab === 'prompts' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Prompt library</p>
                  {PROMPT_LIBRARY.map((p, i) => (
                    <button key={i} onClick={() => { setApiBody(`{\n  "prompt": "${p.prompt}",\n  "style": "cinematic",\n  "ar": "16:9"\n}`); setBuildTab('api') }}
                      className="w-full text-left p-4 rounded-xl border border-[#E8E8EF] hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors group">
                      <p className="text-sm font-semibold text-[#374151] group-hover:text-indigo-700 mb-1">{p.label}</p>
                      <p className="text-xs text-[#9CA3AF] leading-relaxed">{p.prompt}</p>
                    </button>
                  ))}
                </div>
              )}
              {buildTab === 'models' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Select model</p>
                  {BUILD_MODELS.map(m => (
                    <button key={m.id} onClick={() => setActiveModel(m.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${activeModel === m.id ? 'border-indigo-300 bg-indigo-50' : 'border-[#E8E8EF] hover:border-indigo-200 hover:bg-[#F7F7FA]'}`}>
                      <Cpu size={16} className={activeModel === m.id ? 'text-indigo-600' : 'text-[#9CA3AF]'} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#374151]">{m.label}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${activeModel === m.id ? 'bg-indigo-100 text-indigo-700' : 'bg-[#F7F7FA] text-[#9CA3AF]'}`}>{m.badge}</span>
                      {activeModel === m.id && <CheckIcon size={14} className="text-indigo-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
              {buildTab === 'tools' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Function tools</p>
                  {BUILD_TOOLS.map(t => (
                    <div key={t.id} className="flex items-start gap-3 p-4 rounded-xl border border-[#E8E8EF]">
                      <Wrench size={14} className="text-[#9CA3AF] mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#374151]">{t.label}</p>
                        <p className="text-xs text-[#9CA3AF] mt-0.5">{t.desc}</p>
                      </div>
                      <button onClick={() => setEnabledTools(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                        className={`shrink-0 w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${enabledTools.includes(t.id) ? 'bg-indigo-500' : 'bg-[#D1D5DB]'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${enabledTools.includes(t.id) ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
