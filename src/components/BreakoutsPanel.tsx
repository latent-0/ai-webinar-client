import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Users2, Timer, ArrowRight, Loader2, X } from 'lucide-react'
import { buildRooms, findMyRoom, timerRemainingMs, formatCountdown, type BreakoutSession, type BreakoutRoom } from '../lib/breakouts'
import { getBreakouts, launchBreakouts, closeBreakouts, subscribeToBreakouts } from '../lib/breakoutsClient'
import MonitorGrid from './MonitorGrid'

/**
 * Breakouts (LLP-80 / T-74). Facilitators split the room evenly (or tweak the
 * assignment) with an optional timer; everyone is notified and can jump to
 * their room. Participants see a "join your breakout" prompt.
 */
export default function BreakoutsPanel({
  roomId, canLaunch, participantNames, myName,
}: { roomId: string; canLaunch: boolean; participantNames: string[]; myName: string }) {
  const navigate = useNavigate()
  const [session, setSession] = useState<BreakoutSession | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [showMonitor, setShowMonitor] = useState(false)

  // launcher state
  const [showLauncher, setShowLauncher] = useState(false)
  const [roomCount, setRoomCount] = useState(2)
  const [timerMinutes, setTimerMinutes] = useState('')
  const [plan, setPlan] = useState<BreakoutRoom[]>([])

  const refresh = useCallback(async () => {
    try { setSession(await getBreakouts(roomId)); setUnavailable(false) }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/not configured|not authenticated/i.test(msg)) setUnavailable(true); else setError(msg)
    }
  }, [roomId])

  useEffect(() => {
    void refresh()
    return subscribeToBreakouts(roomId, () => { void refresh() })
  }, [roomId, refresh])

  // Tick once a second while a timer is running.
  useEffect(() => {
    if (!session?.timerEndsAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [session?.timerEndsAt])

  // Recompute the auto-split preview when the room count or roster changes.
  useEffect(() => {
    if (showLauncher) setPlan(buildRooms(roomId, participantNames, roomCount))
  }, [showLauncher, roomCount, participantNames, roomId])

  if (unavailable) {
    return canLaunch ? <div className="text-[11px] text-[#9CA3AF] px-1 py-1">Breakouts unavailable — Supabase not configured.</div> : null
  }

  function reassign(member: string, toIndex: number) {
    setPlan((rooms) => rooms.map((r) => ({
      ...r,
      members: r.index === toIndex
        ? [...r.members.filter((m) => m !== member), member]
        : r.members.filter((m) => m !== member),
    })))
  }

  async function start() {
    setBusy(true); setError(null)
    try {
      const mins = Number(timerMinutes)
      await launchBreakouts(roomId, plan, mins > 0 ? mins : undefined)
      setShowLauncher(false)
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  async function close() {
    setBusy(true)
    try { await closeBreakouts(roomId); setSession(null) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  // ── Active breakouts ──────────────────────────────────────────────────────
  if (session) {
    const mine = findMyRoom(session.rooms, myName)
    const remaining = timerRemainingMs(session.timerEndsAt, now)
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Users2 size={15} className="text-indigo-600 shrink-0" />
          <span className="text-sm font-semibold text-[#111827] flex-1">Breakouts are open</span>
          {remaining != null && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-indigo-700">
              <Timer size={11} /> {remaining > 0 ? formatCountdown(remaining) : "Time's up"}
            </span>
          )}
        </div>

        {mine ? (
          <button
            onClick={() => navigate({ to: '/live/$roomId', params: { roomId: mine.roomId } })}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
          >
            <span>Join {mine.name}</span><ArrowRight size={15} />
          </button>
        ) : (
          <p className="text-[11px] text-[#6B7280] px-1">You haven’t been assigned to a breakout room.</p>
        )}

        <div className="text-[11px] text-[#6B7280] space-y-0.5">
          {session.rooms.map((r) => (
            <div key={r.index} className="flex justify-between">
              <span>{r.name}</span><span className="tabular-nums">{r.members.length}</span>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}
        {canLaunch && (
          <div className="flex gap-2">
            <button onClick={() => setShowMonitor(true)} className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-sm text-indigo-600 hover:bg-indigo-50">
              Monitor rooms
            </button>
            <button onClick={close} disabled={busy} className="px-3 py-1.5 rounded-lg border border-[#E8E8EF] bg-white text-sm text-[#6B7280] hover:text-[#111827]">
              Close
            </button>
          </div>
        )}
        {showMonitor && <MonitorGrid session={session} onClose={() => setShowMonitor(false)} />}
      </div>
    )
  }

  // ── No breakouts: facilitator launcher ────────────────────────────────────
  if (!canLaunch) return null
  return (
    <div className="rounded-xl border border-[#E8E8EF] bg-white p-3">
      {!showLauncher ? (
        <button onClick={() => setShowLauncher(true)} className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500">
          <Users2 size={15} /> Create breakouts
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <Users2 size={15} className="text-indigo-600" /> Create breakouts
            <button onClick={() => setShowLauncher(false)} className="ml-auto text-[#9CA3AF] hover:text-[#111827]"><X size={14} /></button>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#374151]">
            <label className="flex items-center gap-1">Rooms
              <input type="number" min={2} max={8} value={roomCount}
                onChange={(e) => setRoomCount(Math.max(2, Math.min(8, Number(e.target.value) || 2)))}
                className="w-14 px-2 py-1 rounded border border-[#E8E8EF]" />
            </label>
            <label className="flex items-center gap-1">Timer (min)
              <input type="number" min={0} value={timerMinutes} placeholder="—"
                onChange={(e) => setTimerMinutes(e.target.value)}
                className="w-14 px-2 py-1 rounded border border-[#E8E8EF]" />
            </label>
          </div>
          <p className="text-[10px] text-[#9CA3AF]">{participantNames.length} participant{participantNames.length === 1 ? '' : 's'} · split evenly (reassign below if needed)</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {plan.map((r) => (
              <div key={r.index}>
                <div className="text-[11px] font-medium text-[#374151]">{r.name} · {r.members.length}</div>
                {r.members.map((m) => (
                  <div key={m} className="flex items-center gap-1 pl-2 py-0.5 text-[11px] text-[#6B7280]">
                    <span className="flex-1 truncate">{m}</span>
                    <select value={r.index} onChange={(e) => reassign(m, Number(e.target.value))}
                      className="text-[10px] rounded border border-[#E8E8EF] px-1 py-0.5">
                      {plan.map((rr) => <option key={rr.index} value={rr.index}>Room {rr.index}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={start} disabled={busy} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Users2 size={14} />} Start breakouts
          </button>
        </div>
      )}
    </div>
  )
}
