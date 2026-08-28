/**
 * AI proxy helpers (LLP-129)
 *
 * The provider API keys (Anthropic, Gemini, Runway, ElevenLabs) used to be
 * shipped to the browser via VITE_* env vars, which inlined them into the
 * client bundle for anyone to read. They now live ONLY on the server and are
 * reached through the /api/ai/* serverless proxies in this folder.
 *
 * Keys are read from NON-VITE env vars so they can never leak into the FE:
 *   ANTHROPIC_API_KEY, GEMINI_API_KEY, RUNWAY_API_KEY, ELEVENLABS_API_KEY
 */

import { getSession } from './auth.js'

/** Server-side key accessors — never exposed to the client. */
export const KEYS = {
  claude: () => process.env.ANTHROPIC_API_KEY || '',
  gemini: () => process.env.GEMINI_API_KEY || '',
  groq: () => process.env.GROQ_API_KEY || '',
  runway: () => process.env.RUNWAY_API_KEY || '',
  elevenlabs: () => process.env.ELEVENLABS_API_KEY || '',
}

/**
 * Gate every proxy behind a valid session so it is not an open relay that
 * anyone could use to burn the account's API credits. Returns the session, or
 * writes a 401 and returns null.
 */
export function requireSession(req, res) {
  const session = getSession(req)
  if (!session) {
    res.status(401).json({ error: 'Not authenticated.' })
    return null
  }
  return session
}

/** Enforce a single HTTP method. Returns true if the request may proceed. */
export function requireMethod(req, res, method) {
  if (req.method !== method) {
    res.setHeader('Allow', method)
    res.status(405).json({ error: `Method not allowed. Use ${method}.` })
    return false
  }
  return true
}

/** Parse a JSON body whether or not the platform pre-parsed it. */
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return {} }
}
