/**
 * GET /api/auth/google/callback?code=...&state=...  (LLP-12 / T-06)
 *
 * Completes Google OAuth: verifies the CSRF state, exchanges the code for an
 * id_token, extracts the verified email, checks the allowlist, and issues a
 * session cookie. Redirects back into the app in all outcomes.
 */

import {
  getBaseUrl, signToken, sessionCookie, verifyToken,
  isEmailAllowed, SESSION_TTL_SEC,
} from '../../_lib/auth.js'
import { tokenCookie } from '../../_lib/googleTokens.js'

export default async function handler(req, res) {
  const redirect = (path) => {
    res.statusCode = 302
    res.setHeader('Location', path)
    res.end()
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return redirect('/?auth=error')

  const code = req.query?.code
  const statePayload = verifyToken(String(req.query?.state))
  if (!code || !statePayload) return redirect('/?auth=invalid')
  const isConnect = statePayload.flow === 'connect'

  try {
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`)
    const tokens = await tokenRes.json()

    const claims = decodeJwtPayload(tokens.id_token)
    const email = claims?.email
    if (!email || claims.email_verified === false) return redirect(isConnect ? '/settings?connected=invalid' : '/?auth=invalid')
    if (!isEmailAllowed(email)) return redirect(isConnect ? '/settings?connected=forbidden' : '/?auth=forbidden')

    const session = signToken({ sub: email, email, method: 'google' }, SESSION_TTL_SEC)

    if (isConnect) {
      // Connecting Calendar + Drive: seal the tokens in the integration cookie
      // AND sign the user in, then return to Settings.
      const bundle = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry: Date.now() + (tokens.expires_in || 3600) * 1000,
        scope: tokens.scope,
      }
      res.setHeader('Set-Cookie', [sessionCookie(session), tokenCookie(bundle)])
      return redirect('/settings?connected=google')
    }

    res.setHeader('Set-Cookie', sessionCookie(session))
    return redirect('/?auth=success')
  } catch (err) {
    console.error('[auth] google callback failed:', err)
    return redirect(isConnect ? '/settings?connected=error' : '/?auth=error')
  }
}

/** Decode a JWT payload without verifying (id_token comes straight from Google's TLS endpoint). */
function decodeJwtPayload(jwt) {
  try {
    const part = String(jwt).split('.')[1]
    return JSON.parse(Buffer.from(part, 'base64url').toString())
  } catch {
    return null
  }
}
