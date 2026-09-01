/**
 * POST /api/integrations/disconnect
 * Revokes the Google token (best-effort) and clears the integration cookie.
 */

import { readTokens, clearTokenCookie } from '../_lib/googleTokens.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }
  const bundle = readTokens(req)
  const token = bundle?.refresh_token || bundle?.access_token
  if (token) {
    try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }) } catch { /* best-effort */ }
  }
  res.setHeader('Set-Cookie', clearTokenCookie())
  return res.status(200).json({ ok: true })
}
