/**
 * POST /api/ai/gemini  (LLP-129)
 *
 * Server-side proxy for Google Gemini. The key (GEMINI_API_KEY) stays on the
 * server; the browser only ever talks to this endpoint. The frontend builds
 * the full prompt and this endpoint simply runs it.
 *
 * Body: { prompt: string, model?: string }
 * 200:  { text: string }
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { KEYS, requireSession, requireMethod, readJson } from '../_lib/ai.js'

const DEFAULT_MODEL = 'gemini-2.5-flash'

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!requireSession(req, res)) return

  const key = KEYS.gemini()
  if (!key) return res.status(503).json({ error: 'Gemini is not configured.' })

  const { prompt, model } = await readJson(req)
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'A "prompt" string is required.' })
  }

  try {
    const genAI = new GoogleGenerativeAI(key)
    const gm = genAI.getGenerativeModel({ model: typeof model === 'string' && model ? model : DEFAULT_MODEL })
    const result = await gm.generateContent(prompt)
    return res.status(200).json({ text: result.response.text() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(502).json({ error: msg })
  }
}
