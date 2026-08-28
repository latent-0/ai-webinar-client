/**
 * GET /api/ai/config  (LLP-129)
 *
 * Reports which AI providers are configured server-side, so the frontend can
 * enable/disable features WITHOUT ever seeing the keys themselves.
 */

import { KEYS, requireSession, requireMethod } from '../_lib/ai.js'

export default function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  if (!requireSession(req, res)) return
  return res.status(200).json({
    claude: Boolean(KEYS.claude()),
    gemini: Boolean(KEYS.gemini()),
    groq: Boolean(KEYS.groq()),
    runway: Boolean(KEYS.runway()),
    elevenlabs: Boolean(KEYS.elevenlabs()),
  })
}
