/**
 * /api/live/presence  (LLP-82 / T-76)
 *
 * Lightweight room-presence heartbeats for the facilitator monitor grid.
 *   POST { roomId }                 → record a heartbeat for the caller
 *   GET  ?roomIds=a,b,c             → recent presence per room (last 30s)
 *
 * Identity is the session email; the display label is passed through so the
 * monitor can show names. Writes use the Supabase service role.
 */

import { getSession } from '../_lib/auth.js'
import { getServiceClient, supabaseConfigured } from '../_lib/supabase.js'
import { readJson } from '../_lib/ai.js'

const RECENT_MS = 30_000

export default async function handler(req, res) {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'Not authenticated.' })
  if (!supabaseConfigured()) return res.status(503).json({ error: 'Presence is not configured (Supabase).' })
  const db = getServiceClient()

  try {
    if (req.method === 'POST') {
      const { roomId, label } = await readJson(req)
      if (!roomId) return res.status(400).json({ error: 'roomId is required.' })
      const identity = label || session.email
      const { error } = await db
        .from('room_presence')
        .upsert({ room_id: roomId, identity, last_seen: new Date().toISOString() }, { onConflict: 'room_id,identity' })
      if (error) return res.status(502).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'GET') {
      const raw = req.query?.roomIds
      const roomIds = String(raw || '').split(',').map((s) => s.trim()).filter(Boolean)
      if (!roomIds.length) return res.status(200).json({ presence: {} })
      const since = new Date(Date.now() - RECENT_MS).toISOString()
      const { data, error } = await db
        .from('room_presence')
        .select('room_id, identity, last_seen')
        .in('room_id', roomIds)
        .gte('last_seen', since)
      if (error) return res.status(502).json({ error: error.message })
      const presence = {}
      for (const id of roomIds) presence[id] = []
      for (const row of data || []) {
        ;(presence[row.room_id] ||= []).push({ identity: row.identity, lastSeen: new Date(row.last_seen).getTime() })
      }
      return res.status(200).json({ presence })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
