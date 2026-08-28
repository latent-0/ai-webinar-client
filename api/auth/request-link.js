/**
 * POST /api/auth/request-link  (LLP-12 / T-06)
 *
 * Body: { email }
 * Creates a single-use, 15-minute magic link and emails it. Enumeration-safe:
 * always responds 200 with a generic message; a link is only actually created
 * and sent for permitted addresses.
 */

import {
  isEmailAllowed, isValidEmail, randomId, getBaseUrl, isProduction, MAGIC_LINK_TTL_SEC,
} from '../_lib/auth.js'
import { putToken, usingDurableStore, usingSupabaseStore } from '../_lib/store.js'
import { sendMagicLink } from '../_lib/email.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {}
  const email = (body.email || '').trim()

  const generic = { ok: true, message: 'If your email is permitted, a sign-in link is on its way.' }

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Enter a valid email address.' })
  }

  if (!isEmailAllowed(email)) {
    // Do not reveal whether the address is permitted.
    return res.status(200).json(generic)
  }

  try {
    const id = randomId(32)
    await putToken(id, JSON.stringify({ email }), MAGIC_LINK_TTL_SEC)
    const link = `${getBaseUrl(req)}/api/auth/consume?token=${id}`
    const result = await sendMagicLink(email, link)

    const payload = { ...generic }
    // In dev (no email provider, non-production) surface the link so the flow
    // can be tested without an inbox. In production the link is normally never
    // leaked — EXCEPT when ALLOW_DEV_SIGNIN is explicitly set, a deliberate
    // demo-only escape hatch for showcasing the app before an email provider
    // (RESEND_API_KEY) is wired up. Remove that env var to lock sign-in down.
    const allowDevSignin =
      process.env.ALLOW_DEV_SIGNIN === '1' || process.env.ALLOW_DEV_SIGNIN === 'true'
    if (result.dev && (!isProduction() || allowDevSignin)) {
      payload.devLink = link
      payload.note = isProduction()
        ? 'Demo mode: email delivery not configured. Use this link to sign in.'
        : 'Dev mode: no email provider configured. Use devLink to sign in.'
    }
    if (!usingDurableStore() && !usingSupabaseStore() && !isProduction()) {
      payload.storeWarning = 'Using in-memory token store (dev only). Configure Vercel KV or Supabase for production.'
    }
    return res.status(200).json(payload)
  } catch (err) {
    console.error('[auth] request-link failed:', err)
    return res.status(500).json({ ok: false, error: 'Could not send sign-in link. Try again.' })
  }
}

function safeJson(s) {
  try { return JSON.parse(s) } catch { return {} }
}
