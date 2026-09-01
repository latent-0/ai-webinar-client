/**
 * JaaS (Jitsi as a Service / 8x8) JWT signing.
 *
 * Signs the RS256 token that lets a participant join a private JaaS room and
 * become a moderator, so the meeting starts immediately (no "waiting for a
 * moderator" lobby) and the room is not a guessable public meet.jit.si slug.
 *
 * Configured via env: JAAS_APP_ID (vpaas-magic-cookie-…), JAAS_KID (the API key
 * id), JAAS_PRIVATE_KEY (PEM, RS256). When unset, the app falls back to public
 * meet.jit.si.
 */

import crypto from 'node:crypto'

export function jaasConfigured() {
  return Boolean(process.env.JAAS_APP_ID && process.env.JAAS_KID && process.env.JAAS_PRIVATE_KEY)
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

/**
 * Sign a JaaS JWT for `room`.
 *
 * NOTE: every participant is granted moderator so the conference always starts
 * for the demo — the reported blocker was "no moderator arrives". A productised
 * build should gate moderator to the room creator via a server-side room
 * registry; the room stays private either way (only tokens signed by this key
 * can join).
 */
export function signJaasJwt({ room, user, moderator = true }) {
  const appId = process.env.JAAS_APP_ID
  const kid = process.env.JAAS_KID
  const privateKey = String(process.env.JAAS_PRIVATE_KEY).replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', kid, typ: 'JWT' }
  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: appId,
    room: room || '*',
    iat: now,
    nbf: now - 10,
    exp: now + 60 * 60 * 4, // 4 hours
    context: {
      user: {
        id: user?.id || 'guest',
        name: user?.name || 'Guest',
        email: user?.email || '',
        avatar: '',
        moderator: moderator ? 'true' : 'false',
      },
      features: {
        livestreaming: 'false',
        recording: 'false',
        transcription: 'false',
        'outbound-call': 'false',
      },
    },
  }

  const signingInput = `${b64url(header)}.${b64url(payload)}`
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey).toString('base64url')
  return `${signingInput}.${signature}`
}
