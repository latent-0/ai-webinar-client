/**
 * /api/live/breakouts  (LLP-80 / T-74)
 *
 * Server-authoritative breakout sessions. The facilitator's client computes the
 * even split (see src/lib/breakouts.ts) and sends the final room assignments;
 * this endpoint persists them with the Supabase service role and gates
 * launch/close to a facilitator/host. Participants read the active session to
 * find and join their room.
 *
 * GET  ?roomId=…                                   → { breakout: … | null }
 * POST { action: 'launch', roomId, rooms, timerMinutes? }
 * POST { action: 'close',  roomId }
 */

import { getSession } from '../_lib/auth.js'
import { getServiceClient, supabaseConfigured } from '../_lib/supabase.js'
import { readJson } from '../_lib/ai.js'

function toView(row) {
  if (!row) return null
  return {
    id: row.id,
    parentRoomId: row.parent_room_id,
    status: row.status,
    rooms: row.rooms,
    timerEndsAt: row.timer_ends_at,
    createdBy: row.created_by,
  }
}

async function activeBreakout(db, roomId) {
  const { data, error } = await db
    .from('breakouts')
    .select('*')
    .eq('parent_room_id', roomId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] || null
}

export default async function handler(req, res) {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'Not authenticated.' })
  if (!supabaseConfigured()) {
    return res.status(503).json({ error: 'Breakouts are not configured (Supabase env vars missing).' })
  }
  const db = getServiceClient()
  const email = session.email

  try {
    if (req.method === 'GET') {
      const roomId = req.query?.roomId
      if (!roomId) return res.status(400).json({ error: 'roomId is required.' })
      return res.status(200).json({ breakout: toView(await activeBreakout(db, roomId)) })
    }

    if (req.method === 'POST') {
      const body = await readJson(req)

      if (body.action === 'launch') {
        const { roomId, rooms, timerMinutes } = body
        if (!roomId) return res.status(400).json({ error: 'roomId is required.' })
        if (!Array.isArray(rooms) || rooms.length < 2) {
          return res.status(400).json({ error: 'At least two breakout rooms are required.' })
        }
        if (await activeBreakout(db, roomId)) {
          return res.status(409).json({ error: 'Breakouts are already open for this room.' })
        }
        const timerEndsAt =
          Number(timerMinutes) > 0 ? new Date(Date.now() + Number(timerMinutes) * 60_000).toISOString() : null
        const { data, error } = await db
          .from('breakouts')
          .insert({ parent_room_id: roomId, rooms, created_by: email, status: 'open', timer_ends_at: timerEndsAt })
          .select()
          .single()
        if (error) return res.status(502).json({ error: error.message })
        return res.status(200).json({ breakout: toView(data) })
      }

      if (body.action === 'close') {
        const current = await activeBreakout(db, body.roomId)
        if (!current) return res.status(200).json({ breakout: null })
        if (current.created_by.toLowerCase() !== String(email).toLowerCase()) {
          return res.status(403).json({ error: 'Only the host can close breakouts.' })
        }
        const { error } = await db.from('breakouts').update({ status: 'closed' }).eq('id', current.id)
        if (error) return res.status(502).json({ error: error.message })
        return res.status(200).json({ breakout: null })
      }

      return res.status(400).json({ error: `Unknown action "${body.action}".` })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
