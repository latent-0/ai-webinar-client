/**
 * GET /api/auth/google/start           → sign-in flow (openid email profile)
 * GET /api/auth/google/start?flow=connect → integration flow (Calendar + Drive,
 *                                            read-only, offline access)
 *
 * Begins the Google OAuth 2.0 flow. Redirects to Google's consent screen with a
 * signed `state` nonce (CSRF guard); the shared callback branches on the flow.
 * Both flows share the same redirect URI, so only one URI is registered in
 * Google Cloud. Returns 501 if Google is not configured.
 */

import { getBaseUrl, signToken } from '../../_lib/auth.js'
import { GOOGLE_SCOPES } from '../../_lib/googleTokens.js'

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return res.status(501).json({ error: 'Google SSO is not configured on this environment.' })
  }

  const connect = req.query?.flow === 'connect'
  const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`
  const state = signToken(
    { n: Math.random().toString(36).slice(2), ...(connect ? { flow: 'connect' } : {}) },
    600, // 10-min CSRF nonce
  )

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: connect ? GOOGLE_SCOPES.join(' ') : 'openid email profile',
    state,
    // Connect needs a refresh token (offline) and a forced consent so the
    // refresh token is always returned; sign-in stays online.
    access_type: connect ? 'offline' : 'online',
    prompt: connect ? 'consent' : 'select_account',
  })
  if (connect) params.set('include_granted_scopes', 'true')

  res.statusCode = 302
  res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  res.end()
}
