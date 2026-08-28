/**
 * Auth helpers (LLP-12 / T-06)
 *
 * Passwordless auth primitives shared by the serverless routes:
 *  - HMAC-signed session tokens (no external JWT dependency)
 *  - httpOnly session cookie helpers
 *  - permitted-email allowlist
 *  - base-URL resolution for building links
 *
 * Secrets are read from the environment. Where a secret is missing the caller
 * degrades gracefully (see each route) so the deployed app never breaks — auth
 * simply reports that it is not yet configured.
 */

import crypto from 'node:crypto'

/** Session lifetime once signed in. */
export const SESSION_TTL_SEC = 60 * 60 * 24 * 7 // 7 days
/** Magic-link lifetime. */
export const MAGIC_LINK_TTL_SEC = 60 * 15 // 15 minutes
export const SESSION_COOKIE = 'llp_session'

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

/** Secret used to sign session tokens. Falls back to a dev-only constant. */
export function getSecret() {
  return process.env.AUTH_SECRET || 'dev-insecure-secret-change-me'
}

export function isConfigured() {
  return Boolean(process.env.AUTH_SECRET)
}

/**
 * Sign a compact HMAC token: base64url(payload).base64url(hmac).
 * Payload always carries an `exp` (unix seconds).
 */
export function signToken(payload, ttlSec) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }
  const encoded = base64url(JSON.stringify(body))
  const sig = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

/** Verify a token; returns the payload object or null if invalid/expired. */
export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [encoded, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url')
  // Constant-time comparison
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ── Cookies ──────────────────────────────────────────────────────────────────

export function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export function sessionCookie(token) {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SEC}`,
  ]
  return attrs.join('; ')
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

/** Return the signed-in user's session payload from the request, or null. */
export function getSession(req) {
  const cookies = parseCookies(req)
  return verifyToken(cookies[SESSION_COOKIE])
}

// ── Email allowlist ──────────────────────────────────────────────────────────

/**
 * Whether an email may sign in.
 *  - ALLOWED_EMAILS: comma-separated exact addresses
 *  - ALLOWED_EMAIL_DOMAINS: comma-separated domains (e.g. "napkin.ie")
 *  - if neither is set, all valid emails are permitted (dev default)
 */
export function isEmailAllowed(email) {
  if (!isValidEmail(email)) return false
  const exact = (process.env.ALLOWED_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const domains = (process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (exact.length === 0 && domains.length === 0) return true
  const lower = email.toLowerCase()
  if (exact.includes(lower)) return true
  const domain = lower.split('@')[1] || ''
  return domains.includes(domain)
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ── Misc ─────────────────────────────────────────────────────────────────────

/** Resolve the deployment base URL for building absolute links. */
export function getBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

export function isProduction() {
  return process.env.VERCEL_ENV === 'production'
}

export function randomId(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}
