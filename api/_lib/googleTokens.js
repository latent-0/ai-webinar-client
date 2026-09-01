/**
 * Google integration tokens (Calendar + Drive)
 *
 * Stores the user's Google OAuth access/refresh tokens in an ENCRYPTED,
 * httpOnly cookie so no database is required. The bundle is sealed with
 * AES-256-GCM using a key derived from AUTH_SECRET, so the token is never
 * readable by client JS and cannot be tampered with.
 *
 * Read scopes only (calendar.readonly, drive.metadata.readonly) — the app can
 * list upcoming events and recent files, never modify anything.
 */

import crypto from 'node:crypto'
import { getSecret } from './auth.js'

const COOKIE = 'llp_gtok'
const TTL_SEC = 60 * 60 * 24 * 30 // 30 days (refresh token lifetime window)

/** Full OAuth scopes requested by the "connect" flow. */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
]

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

// ── Sealed-cookie crypto ──────────────────────────────────────────────────────

let keyCache = null
function key() {
  if (!keyCache) keyCache = crypto.scryptSync(getSecret(), 'llp-gtok-v1', 32)
  return keyCache
}

function seal(obj) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, data]).toString('base64url')
}

function unseal(str) {
  try {
    const buf = Buffer.from(String(str), 'base64url')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const data = buf.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
    decipher.setAuthTag(tag)
    const out = Buffer.concat([decipher.update(data), decipher.final()])
    return JSON.parse(out.toString('utf8'))
  } catch {
    return null
  }
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

function parseCookie(req) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === COOKIE) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

export function tokenCookie(bundle) {
  return [`${COOKIE}=${seal(bundle)}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', `Max-Age=${TTL_SEC}`].join('; ')
}

export function clearTokenCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

/** Read the sealed token bundle from the request, or null. */
export function readTokens(req) {
  const raw = parseCookie(req)
  return raw ? unseal(raw) : null
}

/** Whether the user has connected Google (a decryptable bundle is present). */
export function isConnected(req) {
  return readTokens(req) !== null
}

// ── Access-token lifecycle ────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  return res.json()
}

/**
 * Return a valid access token, transparently refreshing (and re-sealing the
 * cookie) when the current one is expired. Returns null if not connected or the
 * refresh fails.
 */
export async function getValidAccessToken(req, res) {
  const bundle = readTokens(req)
  if (!bundle?.access_token) return null
  // Still valid (with a 60s safety margin)?
  if (bundle.expiry && bundle.expiry > Date.now() + 60_000) return bundle.access_token
  if (!bundle.refresh_token) return null
  const refreshed = await refreshAccessToken(bundle.refresh_token)
  if (!refreshed?.access_token) return null
  const next = {
    ...bundle,
    access_token: refreshed.access_token,
    expiry: Date.now() + (refreshed.expires_in || 3600) * 1000,
  }
  res.setHeader('Set-Cookie', tokenCookie(next))
  return next.access_token
}
