/**
 * Presence client (LLP-82). Heartbeat + read helpers for the monitor grid.
 * Heartbeats are best-effort and silent — if presence isn't configured we stop
 * trying rather than spamming errors.
 */

import type { Presence } from './monitor'

let disabled = false

export async function sendHeartbeat(roomId: string, label: string): Promise<void> {
  if (disabled) return
  try {
    const res = await fetch('/api/live/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, label }),
      credentials: 'same-origin',
    })
    if (res.status === 503) disabled = true
  } catch { /* best-effort */ }
}

export async function getPresence(roomIds: string[]): Promise<Record<string, Presence[]>> {
  if (!roomIds.length) return {}
  const res = await fetch(`/api/live/presence?roomIds=${encodeURIComponent(roomIds.join(','))}`, {
    credentials: 'same-origin',
  })
  if (!res.ok) return {}
  const data = await res.json().catch(() => ({}))
  return data.presence || {}
}
