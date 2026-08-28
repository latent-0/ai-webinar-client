/**
 * POST /api/ai/claude  (LLP-129)
 *
 * Server-side proxy for Anthropic. The key (ANTHROPIC_API_KEY) stays on the
 * server; the browser only ever talks to this endpoint.
 *
 * Body: { prompt: string, context?: string, model?: string }
 * 200:  { text: string }
 */

import Anthropic from '@anthropic-ai/sdk'
import { KEYS, requireSession, requireMethod, readJson } from '../_lib/ai.js'

const DEFAULT_MODEL = 'claude-opus-4-8'

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!requireSession(req, res)) return

  const key = KEYS.claude()
  if (!key) return res.status(503).json({ error: 'Anthropic is not configured.' })

  const { prompt, context, model } = await readJson(req)
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'A "prompt" string is required.' })
  }

  const systemPrompt = context
    ? `You are an AI assistant for the Sandbox platform. ${context}\n\nProvide a concise, helpful response.`
    : 'You are an AI assistant for the Sandbox learning platform. Answer questions concisely and helpfully.'

  try {
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.create({
      model: typeof model === 'string' && model ? model : DEFAULT_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = message.content[0]
    const text = block && block.type === 'text' ? block.text : 'Unexpected response format.'
    return res.status(200).json({ text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(502).json({ error: msg })
  }
}
