/**
 * Poll client wrappers (LLP-74)
 *
 * Thin fetch calls to /api/live/poll plus a realtime subscription helper. The
 * server is authoritative; these just move data.
 */

import type { PollView } from './polls'
import { getSupabase } from './supabaseClient'

interface PollResponse { poll: PollView | null; error?: string }

async function call(method: 'GET' | 'POST', body?: Record<string, unknown>, query = ''): Promise<PollResponse> {
  const res = await fetch(`/api/live/poll${query}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Poll request failed (${res.status})`)
  return data
}

export async function getActivePoll(roomId: string): Promise<PollView | null> {
  const { poll } = await call('GET', undefined, `?roomId=${encodeURIComponent(roomId)}`)
  return poll
}

export async function launchPoll(roomId: string, question: string, options: string[]): Promise<PollView | null> {
  const { poll } = await call('POST', { action: 'launch', roomId, question, options })
  return poll
}

export async function castVote(pollId: string, optionId: string): Promise<void> {
  await call('POST', { action: 'vote', pollId, optionId })
}

export async function revealPoll(pollId: string): Promise<PollView | null> {
  const { poll } = await call('POST', { action: 'reveal', pollId })
  return poll
}

export async function closePoll(pollId: string): Promise<void> {
  await call('POST', { action: 'close', pollId })
}

/**
 * Subscribe to poll changes for a room via Supabase realtime. Calls `onChange`
 * whenever a poll row for the room is inserted/updated (e.g. a reveal), so the
 * caller can re-fetch its allowed view. Returns an unsubscribe function; a
 * no-op if Supabase realtime is not configured.
 */
export function subscribeToRoomPolls(roomId: string, onChange: () => void): () => void {
  const sb = getSupabase()
  if (!sb) return () => {}
  const channel = sb
    .channel(`polls:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'polls', filter: `room_id=eq.${roomId}` },
      () => onChange(),
    )
    .subscribe()
  return () => { sb.removeChannel(channel) }
}
