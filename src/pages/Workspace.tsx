import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import {
  Zap, Share2, Check, Brain,
  Target, FolderOpen, Sparkles, Lightbulb, Package,
  Send, Users, X, ChevronLeft, ChevronRight,
  Mic, MicOff, Video, VideoOff,
  PhoneOff, Radio, Wrench, BookOpen, ExternalLink,
  Crown, MessageSquare, LayoutGrid,
} from 'lucide-react'
import { useAppStore } from '../store'
import { usePersistStore } from '../store/persist'
import { runAgent, TOOLS } from '../lib/agents'
import PollPanel from '../components/PollPanel'
import BreakoutsPanel from '../components/BreakoutsPanel'
import { mediaPermissionNotice, type PermState } from '../lib/media'
import { sendHeartbeat } from '../lib/presenceClient'
import { getVideoConfig, type VideoConfig } from '../lib/videoClient'

interface JitsiParticipant {
  participantId?: string
  id?: string
  displayName?: string
  formattedDisplayName?: string
  role?: string
  roomName?: string
  muted?: boolean
  // ── Chat event payload fields (incomingMessage) ──
  nick?: string
  from?: string
  message?: string
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

/** A message in the participant chat. Real people only — the AI lives in the
 *  Assistant panel, never here (LLP-144). */
interface ChatMsg  { id: string; user: string; avatar: string; time: string; content: string; self?: boolean }
interface AIMsg    { id: string; role: 'user' | 'assistant'; content: string }
/** A person in the room (T-64 / LLP-70). */
interface RosterEntry { id: string; name: string; isLocal: boolean; isHost: boolean }

/** Which surface fills the main stage. Talking → video large; working → the
 *  Sandbox fills the stage with the speaker in a corner (LLP-139). */
type StageView = 'stage' | 'sandbox'

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

const AVATAR_COLORS = ['bg-rose-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-violet-500']
/** Deterministic per-name avatar colour (no seeded/fake identities). */
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

const SESSION_TIPS = [
  'Clear goals unlock better AI outputs.',
  'More context in Inputs means richer Insights.',
  'Iterate with small changes, not big jumps.',
  'Ground every answer in real account data.',
  'Keep human judgement in the loop.',
  'Present your thinking — output shapes the next goal.',
]

const SOURCES = [
  { title: 'Google Ads Help — Auction & Ad Rank', domain: 'support.google.com', url: 'https://support.google.com/google-ads/answer/1704431' },
  { title: 'Smart Bidding best practices', domain: 'support.google.com', url: 'https://support.google.com/google-ads/answer/7065882' },
  { title: 'Quality Score explained', domain: 'support.google.com', url: 'https://support.google.com/google-ads/answer/6167118' },
  { title: 'Search terms & negative keywords', domain: 'support.google.com', url: 'https://support.google.com/google-ads/answer/2453981' },
]

const PROMPT_LIBRARY = [
  { label: 'Responsive Search Ad', prompt: 'Write 15 headlines and 4 descriptions for a responsive search ad for a Google Ads campaign selling running shoes, with a clear CTA.' },
  { label: 'Negative keyword list', prompt: 'Suggest a starter negative keyword list for a lead-gen Search campaign for an accounting firm.' },
  { label: 'Campaign structure',    prompt: 'Propose a Google Ads account structure (campaigns, ad groups, keywords) for an ecommerce store with 3 product lines.' },
  { label: 'Bidding strategy',      prompt: 'Recommend a bidding strategy for a new Search campaign with no conversion history, and the migration path to tROAS.' },
]

function estimateTokens(...texts: string[]) {
  return Math.ceil(texts.join('').length / 4)
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Workspace() {
  const { roomId } = useParams({ from: '/live/$roomId' })
  const navigate    = useNavigate()
  const { displayName, rooms, updateRoomTokens, endRoom } = useAppStore()
  const room = rooms.find(r => r.id === roomId)
  const isHost = !!room?.host && room.host.toLowerCase() === (displayName || '').toLowerCase()

  // ── Stage / Sandbox view (LLP-139)
  const [view, setView] = useState<StageView>('stage')

  // ── Sandbox blocks
  const [expandedBlock, setExpandedBlock] = useState<BlockId | null>(null)
  const [blockContent, setBlockContent]   = useState<Record<string, string>>({})

  // ── Right rail
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [railTab, setRailTab]             = useState<'assistant' | 'chat' | 'notes' | 'sources'>('assistant')
  const [buildOpen, setBuildOpen]         = useState(false)

  // ── Participant chat (real people, via Jitsi — LLP-144)
  const [chatMsgs, setChatMsgs]   = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')

  // ── Assistant (AI)
  const [assistantMsgs, setAssistantMsgs]       = useState<AIMsg[]>([])
  const [assistantInput, setAssistantInput]     = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)

  // ── Transcript (notes tab)
  const [transcript, setTranscript]             = useState<string | null>(null)
  const [transcriptLoading, setTranscriptLoading] = useState(false)

  // ── Build mode
  const [buildTab, setBuildTab]         = useState<'api' | 'prompts'>('api')
  const [apiBody, setApiBody]           = useState('{\n  "prompt": "Write a responsive search ad for running shoes",\n  "style": "concise",\n  "count": 3\n}')
  const [apiLoading, setApiLoading]     = useState(false)
  const [apiResponse, setApiResponse]   = useState<string | null>(null)

  // ── Misc
  const [copied, setCopied]                   = useState(false)
  const [videoCfg, setVideoCfg]               = useState<VideoConfig | null>(null)
  const [leaveOpen, setLeaveOpen]             = useState(false)
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
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMsgs, railTab])
  useEffect(() => { assistantEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [assistantMsgs])

  // ── Reset assistant messages when block changes
  useEffect(() => { setAssistantMsgs([]) }, [expandedBlock])

  // ── Resolve the video backend (JaaS if configured, else public meet.jit.si).
  useEffect(() => {
    let stop = false
    void getVideoConfig(roomId, displayName || 'Guest').then((c) => { if (!stop) setVideoCfg(c) })
    return () => { stop = true }
  }, [roomId, displayName])

  // ── Load the right Jitsi external_api.js for the resolved backend.
  useEffect(() => {
    if (!videoCfg) return
    const src = videoCfg.configured
      ? `https://8x8.vc/${videoCfg.appId}/external_api.js`
      : 'https://meet.jit.si/external_api.js'
    const existing = document.getElementById('jitsi-api-script') as HTMLScriptElement | null
    if (existing) {
      // A script (possibly for the other backend) is already loaded this
      // session; the JitsiMeetExternalAPI global is shared, so just proceed.
      setJitsiLoaded(true)
      return
    }
    const s = document.createElement('script')
    s.id = 'jitsi-api-script'
    s.src = src
    s.async = true
    s.onload = () => setJitsiLoaded(true)
    document.body.appendChild(s)
  }, [videoCfg])

  // ── Init Jitsi. The container lives OUTSIDE the collapsible rail and is never
  //    conditionally unmounted, so collapsing a panel or switching the stage
  //    view can no longer end the call (LLP-141).
  useEffect(() => {
    if (!jitsiLoaded || !jitsiContainerRef.current || !videoCfg) return
    if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); jitsiApiRef.current = null }
    // JaaS (private, host is moderator so the meeting starts) when configured;
    // otherwise fall back to public meet.jit.si.
    const domain = videoCfg.configured ? (videoCfg.domain || '8x8.vc') : 'meet.jit.si'
    const roomName = videoCfg.configured ? (videoCfg.roomName as string) : `sandbox-live-${roomId}`
    const options: Record<string, unknown> = {
      roomName,
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
        FILM_STRIP_MAX_HEIGHT: 80,
      },
    }
    if (videoCfg.configured && videoCfg.jwt) options.jwt = videoCfg.jwt
    const api = new window.JitsiMeetExternalAPI(domain, options)
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
      // Real, in-room chat from other participants (LLP-144). Our own outgoing
      // messages are echoed locally on send, so we only render remote ones here.
      incomingMessage: (e) => {
        const content = (e?.message || '').trim()
        if (!content) return
        const user = e?.nick || e?.from || 'Guest'
        setChatMsgs(m => [
          ...m,
          { id: `in-${Date.now()}-${m.length}`, user, avatar: user.charAt(0).toUpperCase(), time: nowLabel(), content },
        ])
      },
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
  }, [jitsiLoaded, videoCfg, roomId, displayName, hostName]) // eslint-disable-line react-hooks/exhaustive-deps

  // Presence heartbeat (LLP-82 / T-76) so the facilitator monitor grid can see
  // who is in this room and how active it is. Best-effort; silent if presence
  // is not configured.
  useEffect(() => {
    const label = displayName || 'You'
    void sendHeartbeat(roomId, label)
    const t = setInterval(() => { void sendHeartbeat(roomId, label) }, 10_000)
    return () => clearInterval(t)
  }, [roomId, displayName])

  // Graceful media-permission handling (LLP-76 / T-70).
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
  /** Send a real chat message to everyone in the room via Jitsi. No AI reply —
   *  the AI answers in the Assistant panel only (LLP-144). */
  const sendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text) return
    jitsiApiRef.current?.executeCommand('sendChatMessage', text)
    const me = displayName || 'You'
    setChatMsgs(m => [
      ...m,
      { id: `me-${Date.now()}-${m.length}`, user: me, avatar: me.charAt(0).toUpperCase(), time: nowLabel(), content: text, self: true },
    ])
    setChatInput('')
  }, [chatInput, displayName])

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
        : 'You are the AI assistant in a live Google Ads webinar. Answer attendee questions like a senior PPC specialist.'
      const { answer: ans } = await runAgent(activeBlock ? 'sandbox' : 'assistant', q, { extraContext: context })
      setAssistantMsgs(m => [...m, { id: (Date.now() + 1).toString(), role: 'assistant', content: ans }])
      updateRoomTokens(roomId, estimateTokens(q, context, ans))
    } finally { setAssistantLoading(false) }
  }, [assistantInput, assistantLoading, activeBlock, room, roomId, updateRoomTokens])

  const sendPlayground = useCallback(async () => {
    if (apiLoading) return
    setApiLoading(true); setApiResponse(null)
    try {
      let prompt = 'Generate creative content'
      try { const p = JSON.parse(apiBody); if (p.prompt) prompt = p.prompt } catch { /* free-form body */ }
      const ctx = 'You are a Google Ads specialist. Produce concise, practical, ready-to-use output.'
      const { answer: resp } = await runAgent('assistant', prompt, { extraContext: ctx, skipRetrieval: true })
      setApiResponse(resp)
      updateRoomTokens(roomId, estimateTokens(prompt, ctx, resp))
    } finally { setApiLoading(false) }
  }, [apiBody, apiLoading, roomId, updateRoomTokens])

  async function generateTranscript() {
    if (transcriptLoading) return
    setTranscriptLoading(true)
    try {
      const prompt = `Generate a realistic 5-minute Google Ads webinar transcript excerpt for room "${roomId}". Include a Host and a couple of attendees, timestamps in [MM:SS], and natural Q&A about campaigns and bidding.`
      const { answer: t } = await TOOLS.transcript.run(prompt)
      setTranscript(t)
      updateRoomTokens(roomId, estimateTokens(prompt, t))
    } finally { setTranscriptLoading(false) }
  }

  async function shareRoom() {
    await navigator.clipboard.writeText(`${window.location.origin}/live/${roomId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function askInAssistant(text: string) {
    setAssistantInput(text)
    setRailTab('assistant')
    setRailCollapsed(false)
  }

  function toggleMic() { jitsiApiRef.current?.executeCommand('toggleAudio'); setMicMuted(m => !m) }
  function toggleCam() { jitsiApiRef.current?.executeCommand('toggleVideo'); setCamMuted(c => !c) }
  /** Leave the room: hang up the call and return to the lobby. */
  function leaveSession() {
    try { jitsiApiRef.current?.executeCommand('hangup') } catch { /* ignore */ }
    navigate({ to: '/live' })
  }
  /** Host: end the session for everyone (blocks further joins), then leave. */
  function endSession() {
    endRoom(roomId)
    leaveSession()
  }

  // ── Video stage (always mounted). Large in stage view; a corner PiP while the
  //    Sandbox fills the stage (LLP-139 / LLP-141).
  const stageEl = (
    <div
      className={
        view === 'stage'
          ? 'absolute inset-0'
          : 'absolute bottom-4 right-4 w-52 h-32 sm:w-60 sm:h-36 rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/20 z-30'
      }
    >
      <div ref={jitsiContainerRef} className="absolute inset-0 bg-[#0f0f13]" />
      {!jitsiLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[10px] text-white/50">Connecting…</p>
          </div>
        </div>
      )}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold pointer-events-none">
        <Radio size={8} /> LIVE
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 p-2 bg-gradient-to-t from-black/60 to-transparent">
        <button onClick={toggleMic} title={micMuted ? 'Unmute' : 'Mute'}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${micMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}>
          {micMuted ? <MicOff size={13} className="text-white" /> : <Mic size={13} className="text-white" />}
        </button>
        <button onClick={toggleCam} title={camMuted ? 'Start video' : 'Stop video'}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${camMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}>
          {camMuted ? <VideoOff size={13} className="text-white" /> : <Video size={13} className="text-white" />}
        </button>
        <button onClick={() => setLeaveOpen(true)} title="Leave" className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors">
          <PhoneOff size={13} className="text-white" />
        </button>
      </div>
    </div>
  )

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
          <span className="text-xs text-[#6B7280] font-medium truncate max-w-[140px]">{roomId}</span>
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

        {/* Stage / Sandbox toggle (LLP-139) */}
        <div className="hidden md:flex items-center gap-0.5 ml-1 p-0.5 rounded-lg bg-[#F7F7FA] border border-[#E8E8EF]">
          <button onClick={() => setView('stage')} title="Speaker / share on the main stage"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === 'stage' ? 'bg-white shadow-sm text-[#111827]' : 'text-[#9CA3AF] hover:text-[#374151]'}`}>
            <Radio size={12} /> Stage
          </button>
          <button onClick={() => setView('sandbox')} title="Work on the main stage, speaker in the corner"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === 'sandbox' ? 'bg-white shadow-sm text-[#111827]' : 'text-[#9CA3AF] hover:text-[#374151]'}`}>
            <LayoutGrid size={12} /> Sandbox
          </button>
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

        <button onClick={() => setLeaveOpen(true)} title="Leave session"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium transition-colors ml-1">
          <PhoneOff size={13} /> Leave
        </button>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Centre stage ────────────────────────────────────────────────────── */}
        <div className="flex-1 relative min-w-0 overflow-hidden bg-[#0f0f13]">
          {/* Sandbox surface — fills the stage in sandbox view */}
          {view === 'sandbox' && (
            <div className="absolute inset-0 bg-[#F7F7FA] overflow-y-auto">
              {expandedBlock ? (
                (() => {
                  const block = BLOCKS.find(b => b.id === expandedBlock)!
                  const Icon  = block.icon
                  const c     = COLORS[block.color]
                  return (
                    <div className="flex flex-col min-h-full">
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
                        <button onClick={() => askInAssistant(block.hint)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-medium transition-colors">
                          <Sparkles size={11} /> Ask AI
                        </button>
                      </div>
                      <div className="flex-1 p-6 min-h-0">
                        <textarea
                          value={blockContent[expandedBlock] || ''}
                          onChange={e => setBlockContent(prev => ({ ...prev, [expandedBlock]: e.target.value }))}
                          placeholder={block.placeholder}
                          className="w-full h-full min-h-64 p-5 rounded-2xl border border-[#E8E8EF] bg-white text-sm text-[#374151] leading-relaxed resize-none focus:outline-none focus:border-indigo-300 placeholder-[#D1D5DB] shadow-sm"
                        />
                      </div>
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
              )}
            </div>
          )}

          {/* Media-permission notice (stage view) */}
          {view === 'stage' && mediaNotice && !noticeDismissed && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-start gap-2 px-3 py-2 max-w-md rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 shadow-lg">
              <VideoOff size={12} className="mt-0.5 shrink-0" />
              <span className="flex-1 leading-snug">{mediaNotice}</span>
              <button onClick={() => setNoticeDismissed(true)} className="shrink-0 text-amber-500 hover:text-amber-700" title="Dismiss">
                <X size={12} />
              </button>
            </div>
          )}

          {/* The always-mounted video stage */}
          {stageEl}
        </div>

        {/* ── Right rail ───────────────────────────────────────────────────────── */}
        <div className={`hidden md:flex flex-col bg-white border-l border-[#E8E8EF] shrink-0 transition-all duration-300 overflow-hidden ${railCollapsed ? 'w-11' : 'w-80'}`}>
          {railCollapsed ? (
            <button onClick={() => setRailCollapsed(false)}
              className="flex-1 flex flex-col items-center justify-center gap-2 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F7F7FA] transition-colors">
              <Brain size={14} />
              <ChevronLeft size={10} />
            </button>
          ) : (
            <>
              {/* Rail tabs */}
              <div className="flex items-center border-b border-[#E8E8EF] px-2 shrink-0">
                {([
                  { id: 'assistant', label: 'Assistant', icon: Brain },
                  { id: 'chat', label: 'Chat', icon: MessageSquare },
                  { id: 'notes', label: 'Notes', icon: BookOpen },
                  { id: 'sources', label: 'Sources', icon: ExternalLink },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setRailTab(t.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium transition-colors relative ${railTab === t.id ? 'text-indigo-600' : 'text-[#9CA3AF] hover:text-[#6B7280]'}`}>
                    <t.icon size={12} /> <span className="hidden lg:inline">{t.label}</span>
                    {railTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600 rounded-t-full" />}
                  </button>
                ))}
                <div className="flex-1" />
                <button onClick={() => setRailCollapsed(true)} className="p-1 rounded hover:bg-[#F7F7FA] text-[#9CA3AF] transition-colors">
                  <ChevronRight size={12} />
                </button>
              </div>

              {/* Assistant (AI) */}
              {railTab === 'assistant' && (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                    {activeBlock && (
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-medium ${COLORS[activeBlock.color].tag}`}>
                        {activeBlock.title}
                      </span>
                    )}
                    {assistantMsgs.length === 0 && (
                      <div className="text-center py-8">
                        <Brain size={28} className="text-[#E8E8EF] mx-auto mb-3" />
                        <p className="text-xs text-[#9CA3AF] leading-relaxed">Ask the AI anything about your Google Ads campaigns — the auction, Quality Score, bidding, structure, or measurement.</p>
                      </div>
                    )}
                    {assistantMsgs.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mr-2 shrink-0 mt-0.5">
                            <Brain size={11} className="text-indigo-600" />
                          </div>
                        )}
                        <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
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
                        placeholder={activeBlock ? `Ask about ${activeBlock.title.toLowerCase()}…` : 'Ask the AI anything…'}
                        className="flex-1 px-3 py-2 rounded-lg bg-[#F7F7FA] border border-[#E8E8EF] text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-indigo-400" />
                      <button type="submit" disabled={!assistantInput.trim() || assistantLoading}
                        className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-600 transition-colors">
                        <Send size={13} />
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* Chat (real people) */}
              {railTab === 'chat' && (
                <>
                  {/* Session tools: polls + breakouts */}
                  <div className="px-3 py-2 border-b border-[#E8E8EF] shrink-0 space-y-2 empty:hidden [&:not(:has(>*))]:hidden">
                    <PollPanel roomId={roomId} canLaunch={canLaunchPolls} />
                    <BreakoutsPanel
                      roomId={roomId}
                      canLaunch={canLaunchPolls}
                      participantNames={participants.map((p) => p.name)}
                      myName={displayName || 'You'}
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
                    {chatMsgs.length === 0 && (
                      <div className="text-center py-10 text-[11px] text-[#9CA3AF]">
                        <MessageSquare size={22} className="mx-auto mb-2 opacity-40" />
                        No messages yet. Say hello to the room.
                      </div>
                    )}
                    {chatMsgs.map(msg => (
                      <div key={msg.id} className="flex items-start gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white ${avatarColor(msg.user)}`}>
                          {msg.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1">
                            <span className="text-[11px] font-semibold text-[#374151]">{msg.user}{msg.self ? ' (you)' : ''}</span>
                            <span className="text-[9px] text-[#9CA3AF]">{msg.time}</span>
                          </div>
                          <p className="text-[11px] text-[#6B7280] leading-relaxed break-words">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={sendChat} className="px-3 py-2 border-t border-[#E8E8EF] flex items-center gap-2 shrink-0">
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message the room…"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#F7F7FA] border border-[#E8E8EF] text-[11px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-indigo-300" />
                    <button type="submit" disabled={!chatInput.trim()}
                      className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors">
                      <Send size={12} />
                    </button>
                  </form>
                </>
              )}

              {/* Notes */}
              {railTab === 'notes' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  <div>
                    <p className="text-xs font-semibold text-[#374151] mb-2">Tips</p>
                    <ul className="space-y-1.5">
                      {SESSION_TIPS.map(note => (
                        <li key={note} className="flex items-start gap-2 text-xs text-[#6B7280]">
                          <span className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0" />{note}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-t border-[#E8E8EF] pt-4">
                    <p className="text-xs font-semibold text-[#374151] mb-1">Transcript</p>
                    <p className="text-[10px] text-[#9CA3AF] mb-2">AI-generated sample — not a recording of this session.</p>
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

              {/* Sources */}
              {railTab === 'sources' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-3">Google Ads references</p>
                  {SOURCES.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2.5 rounded-lg border border-[#E8E8EF] hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors group">
                      <BookOpen size={12} className="text-[#9CA3AF] group-hover:text-indigo-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#374151] leading-tight">{s.title}</p>
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5">{s.domain}</p>
                      </div>
                      <ExternalLink size={10} className="text-[#D1D5DB] group-hover:text-indigo-400 shrink-0 mt-0.5" />
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Leave / End confirm ─────────────────────────────────────────────────── */}
      {leaveOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center px-4" onClick={() => setLeaveOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm p-5 rounded-2xl bg-white border border-[#E8E8EF] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <PhoneOff size={16} className="text-red-500" />
              <h4 className="text-sm font-semibold text-[#111827]">Leave this session?</h4>
            </div>
            <p className="text-xs text-[#6B7280] mb-4">
              You’ll return to the Live lobby.{isHost ? ' As the host, you can also end the session for everyone — this blocks further joins.' : ''}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setLeaveOpen(false)} className="flex-1 py-2 rounded-lg border border-[#E8E8EF] text-sm font-medium text-[#374151] hover:bg-[#F7F7FA]">Cancel</button>
              <button onClick={leaveSession} className="flex-1 py-2 rounded-lg bg-[#111827] hover:bg-black text-white text-sm font-semibold">Leave</button>
              {isHost && (
                <button onClick={endSession} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold">End session</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Build mode overlay ──────────────────────────────────────────────────── */}
      {buildOpen && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col">
          <div className="h-12 border-b border-[#E8E8EF] flex items-center px-4 gap-3 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#111827] flex items-center justify-center">
              <Wrench size={13} className="text-white" />
            </div>
            <span className="text-sm font-bold">Build</span>
            <span className="text-xs text-[#9CA3AF] px-2 py-1 rounded-full bg-[#F7F7FA] border border-[#E8E8EF]">Assistant playground</span>
            <div className="flex-1" />
            <button onClick={() => setBuildOpen(false)} className="p-1.5 rounded-lg hover:bg-[#F7F7FA] text-[#9CA3AF] hover:text-[#374151] transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="flex border-b border-[#E8E8EF] px-6 shrink-0">
            {(['api', 'prompts'] as const).map(tab => (
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
                      <div className="p-4 rounded-xl bg-[#F7F7FA] border border-dashed border-[#E8E8EF] text-sm text-[#9CA3AF]">Send a request to see the generated output here.</div>
                    )}
                  </div>
                </>
              )}
              {buildTab === 'prompts' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Prompt library</p>
                  {PROMPT_LIBRARY.map((p, i) => (
                    <button key={i} onClick={() => { setApiBody(`{\n  "prompt": "${p.prompt}",\n  "style": "concise",\n  "count": 3\n}`); setBuildTab('api') }}
                      className="w-full text-left p-4 rounded-xl border border-[#E8E8EF] hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors group">
                      <p className="text-sm font-semibold text-[#374151] group-hover:text-indigo-700 mb-1">{p.label}</p>
                      <p className="text-xs text-[#9CA3AF] leading-relaxed">{p.prompt}</p>
                    </button>
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
