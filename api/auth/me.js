/**
 * GET /api/auth/me  (LLP-12 / T-06)
 *
 * Returns the current session (if any) plus a small capability report so the
 * frontend can show whether passwordless auth and Google SSO are configured.
 */

import { getSession, isConfigured } from '../_lib/auth.js'

export default function handler(req, res) {
  const session = getSession(req)
  return res.status(200).json({
    authenticated: Boolean(session),
    email: session?.email ?? null,
    method: session?.method ?? null,
    config: {
      auth: isConfigured(),
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  })
}
