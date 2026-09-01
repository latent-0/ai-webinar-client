/**
 * GET /api/live/token?room=<id>&name=<display name>
 *
 * Issues a JaaS join token for a live room. Returns { configured:false } when
 * JaaS isn't set up, so the client falls back to public meet.jit.si.
 */

import { jaasConfigured, signJaasJwt } from '../_lib/jaas.js'
import { getSession } from '../_lib/auth.js'

export default function handler(req, res) {
  if (!jaasConfigured()) return res.status(200).json({ configured: false })

  const room = String(req.query?.room || '').trim()
  if (!room) return res.status(400).json({ error: 'room is required.' })

  const session = getSession(req)
  const name = String(req.query?.name || session?.email || 'Guest').slice(0, 80)
  const appId = process.env.JAAS_APP_ID

  const jwt = signJaasJwt({
    room,
    user: { id: session?.email || 'guest', name, email: session?.email || '' },
    moderator: true,
  })

  return res.status(200).json({
    configured: true,
    domain: '8x8.vc',
    appId,
    roomName: `${appId}/${room}`,
    jwt,
  })
}
