/**
 * GET /api/auth/consume?token=...  (LLP-12 / T-06)
 *
 * Validates and consumes a magic-link token. On success sets an httpOnly
 * session cookie and redirects to the app. Expired/used/invalid tokens redirect
 * back with an error so the UI can offer to request another link.
 */

import { signToken, sessionCookie, SESSION_TTL_SEC, isEmailAllowed } from '../_lib/auth.js'
import { consumeToken } from '../_lib/store.js'

export default async function handler(req, res) {
  const token = (req.query && req.query.token) || ''
  const redirect = (path) => {
    res.statusCode = 302
    res.setHeader('Location', path)
    res.end()
  }

  if (!token) return redirect('/?auth=invalid')

  try {
    const raw = await consumeToken(String(token))
    if (!raw) return redirect('/?auth=expired')

    const { email } = JSON.parse(raw)
    if (!email || !isEmailAllowed(email)) return redirect('/?auth=invalid')

    const session = signToken({ sub: email, email, method: 'magic-link' }, SESSION_TTL_SEC)
    res.setHeader('Set-Cookie', sessionCookie(session))
    return redirect('/?auth=success')
  } catch (err) {
    console.error('[auth] consume failed:', err)
    return redirect('/?auth=error')
  }
}
