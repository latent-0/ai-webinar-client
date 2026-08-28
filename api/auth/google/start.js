/**
 * GET /api/auth/google/start  (LLP-12 / T-06)
 *
 * Begins the Google OAuth 2.0 sign-in flow. Redirects the browser to Google's
 * consent screen with a signed `state` nonce to guard against CSRF. Returns 501
 * if Google SSO is not configured, so the app degrades gracefully.
 */

import { getBaseUrl, signToken } from '../../_lib/auth.js'

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return res.status(501).json({ error: 'Google SSO is not configured on this environment.' })
  }

  const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`
  const state = signToken({ n: Math.random().toString(36).slice(2) }, 600) // 10-min CSRF nonce

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })

  res.statusCode = 302
  res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  res.end()
}
