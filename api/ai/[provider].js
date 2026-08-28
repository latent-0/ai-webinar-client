/**
 * Dynamic AI proxy route — LLP-129
 *
 * A SINGLE serverless function that serves every /api/ai/<provider> path
 * (groq, claude, gemini, runway, elevenlabs, config). Consolidating the six
 * former handlers into one dynamic route keeps the deployment under the
 * Hobby-plan serverless-function limit without changing any client URLs.
 *
 * Body parsing is disabled so the elevenlabs handler can read raw audio bytes;
 * the JSON handlers use readJson(), which reads the raw stream when needed.
 */

export const config = { api: { bodyParser: false } }

import {
  configHandler, groqHandler, claudeHandler,
  geminiHandler, runwayHandler, elevenlabsHandler,
} from '../_lib/aiHandlers.js'

const HANDLERS = {
  config: configHandler,
  groq: groqHandler,
  claude: claudeHandler,
  gemini: geminiHandler,
  runway: runwayHandler,
  elevenlabs: elevenlabsHandler,
}

export default function handler(req, res) {
  // Vercel populates req.query.provider from the [provider] path segment.
  let provider = req.query && req.query.provider
  if (!provider) {
    // Fallback: derive from the URL path (e.g. under some local setups).
    const path = (req.url || '').split('?')[0]
    provider = path.split('/').filter(Boolean).pop()
  }
  const fn = HANDLERS[provider]
  if (!fn) return res.status(404).json({ error: `Unknown AI endpoint "${provider}".` })
  return fn(req, res)
}
