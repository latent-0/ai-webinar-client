import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { X, ArrowRight, Users } from 'lucide-react'
import type { BreakoutSession } from '../lib/breakouts'
import { roomStatus, type Presence, type ActivityLevel } from '../lib/monitor'
import { getPresence } from '../lib/presenceClient'

const LEVEL_STYLE: Record<ActivityLevel, { dot: string; label: string }> = {
  active: { dot: 'bg-green-500', label: 'Active' },
  quiet: { dot: 'bg-amber-400', label: 'Quiet' },
  idle: { dot: 'bg-gray-300', label: 'Idle' },
}

/**
 * Facilitator monitor grid (LLP-82 / T-76). A tile per breakout room showing
 * who's in it and an at-a-glance activity level, refreshed every 3s (well
 * within the 5s target). Clicking a tile drops the host into that room.
 * (Canvas thumbnails are the deferred second split — see T-61.)
 */
export default function MonitorGrid({ session, onClose }: { session: BreakoutSession; onClose: () => void }) {
  const navigate = useNavigate()
  const [presence, setPresence] = useState<Record<string, Presence[]>>({})
  const [now, setNow] = useState(() => Date.now())

  const roomIds = session.rooms.map((r) => r.roomId)

  const refresh = useCallback(async () => {
    setPresence(await getPresence(roomIds))
    setNow(Date.now())
  }, [roomIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void refresh()
    const t = setInterval(() => { void refresh() }, 3000)
    return () => clearInterval(t)
  }, [refresh])

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-indigo-600" />
          <h2 className="text-sm font-semibold text-[#111827] flex-1">Breakout monitor</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#111827]"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {session.rooms.map((room) => {
            const people = presence[room.roomId] || []
            const status = roomStatus(people, now)
            const style = LEVEL_STYLE[status.level]
            return (
              <button
                key={room.roomId}
                onClick={() => { navigate({ to: '/live/$roomId', params: { roomId: room.roomId } }); onClose() }}
                className="text-left rounded-xl border border-[#E8E8EF] bg-[#F7F7FA] hover:border-indigo-400 hover:bg-white transition-colors p-3 group"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span className="text-xs font-semibold text-[#111827] flex-1 truncate">{room.name}</span>
                  <ArrowRight size={13} className="text-[#9CA3AF] group-hover:text-indigo-600" />
                </div>
                <div className="text-[11px] text-[#6B7280] flex items-center gap-1">
                  <Users size={10} /> {status.count} present · {style.label}
                </div>
                <div className="text-[10px] text-[#9CA3AF] mt-1">{room.members.length} assigned</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
