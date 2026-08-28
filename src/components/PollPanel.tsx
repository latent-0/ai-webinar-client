import { useState, useEffect, useCallback, useRef } from 'react'
import { BarChart3, Plus, X, Check, Eye, Loader2, Send } from 'lucide-react'
import type { PollView } from '../lib/polls'
import { getActivePoll, launchPoll, castVote, revealPoll, closePoll, subscribeToRoomPolls } from '../lib/pollsClient'

/**
 * Live poll panel (LLP-74 / T-68). Rendered inside a session room.
 * - Facilitators can launch a poll, watch the live tally, and reveal/close it.
 * - Participants vote once, then wait for the host to reveal the results.
 */
export default function PollPanel({ roomId, canLaunch }: { roomId: string; canLaunch: boolean }) {
  const [poll, setPoll] = useState<PollView | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showLauncher, setShowLauncher] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const pollRef = useRef<PollView | null>(null)
  pollRef.current = poll

  const refresh = useCallback(async () => {
    try {
      setPoll(await getActivePoll(roomId))
      setUnavailable(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/not configured|not authenticated/i.test(msg)) setUnavailable(true)
      else setError(msg)
    }
  }, [roomId])

  // Initial load + realtime subscription (participants see a reveal instantly).
  useEffect(() => {
    void refresh()
    const unsub = subscribeToRoomPolls(roomId, () => { void refresh() })
    return unsub
  }, [roomId, refresh])

  // While a poll is open, refresh on a short interval so the host sees the
  // tally update live and participants still get the reveal if realtime is off.
  useEffect(() => {
    if (poll?.status !== 'open') return
    const t = setInterval(() => { void refresh() }, 2000)
    return () => clearInterval(t)
  }, [poll?.status, refresh])

  if (unavailable) {
    return canLaunch ? (
      <div className="text-[11px] text-[var(--faint)] px-3 py-2">Polls unavailable — Supabase not configured yet.</div>
    ) : null
  }

  async function doLaunch() {
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim() || opts.length < 2) { setError('Add a question and at least two options.'); return }
    setBusy(true); setError(null)
    try {
      const p = await launchPoll(roomId, question.trim(), opts)
      setPoll(p); setShowLauncher(false); setQuestion(''); setOptions(['', ''])
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  async function doVote(optionId: string) {
    if (!poll) return
    setBusy(true); setError(null)
    try { await castVote(poll.id, optionId); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  async function doReveal() {
    if (!poll) return
    setBusy(true)
    try { setPoll(await revealPoll(poll.id)) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  async function doClose() {
    if (!poll) return
    setBusy(true)
    try { await closePoll(poll.id); setPoll(null) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  // ── No active poll ──────────────────────────────────────────────────────────
  if (!poll) {
    if (!canLaunch) return null
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        {!showLauncher ? (
          <button
            onClick={() => setShowLauncher(true)}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <BarChart3 size={15} /> Launch a poll
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
              <BarChart3 size={15} className="text-indigo-600" /> New poll
            </div>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question…"
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--faint)] focus:outline-none focus:border-indigo-400"
            />
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={opt}
                  onChange={(e) => setOptions((os) => os.map((o, j) => (j === i ? e.target.value : o)))}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--faint)] focus:outline-none focus:border-indigo-400"
                />
                {options.length > 2 && (
                  <button onClick={() => setOptions((os) => os.filter((_, j) => j !== i))} className="text-[var(--faint)] hover:text-red-500">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <button onClick={() => setOptions((os) => [...os, ''])} className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--text)]">
                <Plus size={12} /> Add option
              </button>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={doLaunch} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Launch
              </button>
              <button onClick={() => { setShowLauncher(false); setError(null) }} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--text)]">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Active poll (open or revealed) ────────────────────────────────────────────
  const revealed = poll.status === 'revealed'
  const showBars = poll.isHost || revealed
  const total = poll.total ?? 0

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <BarChart3 size={15} className="text-indigo-600 shrink-0" />
        <span className="text-sm font-semibold text-[var(--text)] flex-1">{poll.question}</span>
        {poll.isHost && (
          <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">{revealed ? 'revealed' : 'live'}</span>
        )}
      </div>

      {/* Voting (participant, open, not yet voted) */}
      {!poll.isHost && !revealed && !poll.youVoted && (
        <div className="space-y-1.5">
          {poll.options.map((o) => (
            <button
              key={o.id}
              onClick={() => doVote(o.id)}
              disabled={busy}
              className="w-full text-left px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:border-indigo-400 disabled:opacity-50 text-sm text-[var(--text)]"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Waiting state (participant voted, not revealed) */}
      {!poll.isHost && !revealed && poll.youVoted && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--muted)] px-1 py-2">
          <Check size={13} className="text-green-500" /> Vote recorded — waiting for the host to reveal the results.
        </p>
      )}

      {/* Result bars (host always, or after reveal) */}
      {showBars && (
        <div className="space-y-1.5">
          {poll.options.map((o) => {
            const count = poll.results?.find((r) => r.optionId === o.id)?.count ?? 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={o.id}>
                <div className="flex justify-between text-xs text-[var(--text-2)] mb-0.5">
                  <span className="truncate">{o.label}</span>
                  <span className="tabular-nums text-[var(--muted)]">{count} · {pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
          <p className="text-[11px] text-[var(--faint)] pt-0.5">{total} vote{total === 1 ? '' : 's'}</p>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Host controls */}
      {poll.isHost && (
        <div className="flex gap-2 pt-1">
          {!revealed && (
            <button onClick={doReveal} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium">
              <Eye size={14} /> Reveal to room
            </button>
          )}
          <button onClick={doClose} disabled={busy} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--text)]">
            Close
          </button>
        </div>
      )}
    </div>
  )
}
