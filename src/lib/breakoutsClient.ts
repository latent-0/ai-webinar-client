/**
 * Breakout client wrappers (LLP-80). Thin calls to /api/live/breakouts plus a
 * realtime subscription so participants are notified instantly.
 */

import type { BreakoutSession, BreakoutRoom } from './breakouts'
import { getSupabase } from './supabaseClient'

interface BreakoutResponse { breakout: BreakoutSession | null; error?: string }

async function call(method: 'GET' | 'POST', body?: Record<string, unknown>, query = ''): Promise<BreakoutResponse> {
  const res = await fetch(`/api/live/breakouts${query}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Breakout request failed (${res.status})`)
  return data
}

export async function getBreakouts(roomId: string): Promise<BreakoutSession | null> {
  const { breakout } = await call('GET', undefined, `?roomId=${encodeURIComponent(roomId)}`)
  return breakout
}

export async function launchBreakouts(
  roomId: string,
  rooms: BreakoutRoom[],
  timerMinutes?: number,
): Promise<BreakoutSession | null> {
  const { breakout } = await call('POST', { action: 'launch', roomId, rooms, timerMinutes })
  return breakout
}

export async function closeBreakouts(roomId: string): Promise<void> {
  await call('POST', { action: 'close', roomId })
}

export function subscribeToBreakouts(roomId: string, onChange: () => void): () => void {
  const sb = getSupabase()
  if (!sb) return () => {}
  const channel = sb
    .channel(`breakouts:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'breakouts', filter: `parent_room_id=eq.${roomId}` },
      () => onChange(),
    )
    .subscribe()
  return () => { sb.removeChannel(channel) }
}
