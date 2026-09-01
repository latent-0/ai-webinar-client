/**
 * GET /api/auth/google/connect
 *
 * Begins the Google *integration* OAuth flow (Calendar + Drive, read-only).
 * Unlike sign-in, this requests offline access so we receive a refresh token,
 * and forces the consent screen so the refresh token is always returned. On
 * success the shared callback stores the tokens and returns to Settings.
 *
 * Reuses the same redirect URI as sign-in, so no extra redirect URI needs to
 * be registered in Google Cloud — only the two read scopes must be added to
 * the OAuth consent screen. Returns 501 if Google is not configured.
 */

import { getBaseUrl, signToken } from '../../_lib/auth.js'
import { GOOGLE_SCOPES, googleConfigured } from '../../_lib/googleTokens.js'

export default function handler(req, res) {
  if (!googleConfigured()) {
    return res.status(501).json({ error: 'Google integration is not configured on this environment.' })
  }

  const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`
  const state = signToken({ n: Math.random().toString(36).slice(2), flow: 'connect' }, 600)

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    state,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
  })

  res.statusCode = 302
  res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  res.end()
}
