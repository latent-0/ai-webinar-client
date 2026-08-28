/**
 * POST /api/ai/groq
 *
 * Server-side proxy for Groq (OpenAI-compatible chat completions). The key
 * (GROQ_API_KEY) stays on the server; the browser only ever talks to this
 * endpoint. Groq is used as the primary TEXT provider.
 *
 * The model is chosen SERVER-SIDE (GROQ_MODEL, default llama-3.3-70b-versatile)
 * so the client can never push us onto a model that would blow the rate limits.
 *
 * Body: { prompt: string, context?: string }
 * 200:  { text: string }
 */

import { KEYS, requireSession, requireMethod, readJson } from '../_lib/ai.js'

// A capable model that stays comfortably inside Groq's free-tier limits.
// gpt-oss-20b is fast and cheap on the rate limits; it is a reasoning model,
// so we cap reasoning effort low and leave token headroom for the answer.
const DEFAULT_MODEL = 'openai/gpt-oss-20b'

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!requireSession(req, res)) return

  const key = KEYS.groq()
  if (!key) return res.status(503).json({ error: 'Groq is not configured.' })

  const { prompt, context } = await readJson(req)
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'A "prompt" string is required.' })
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL
  const systemPrompt = context
    ? `You are an AI assistant for the Sandbox platform. ${context}\n\nProvide a concise, helpful response.`
    : 'You are an AI assistant for the Sandbox learning platform. Answer questions concisely and helpfully.'

  const payload = {
    model,
    // Reasoning models spend tokens thinking before answering, so give enough
    // headroom that the visible answer is never truncated.
    max_tokens: 2048,
    temperature: 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  }
  // gpt-oss models accept reasoning_effort; keep it low for speed + rate limits.
  if (model.includes('gpt-oss')) payload.reasoning_effort = 'low'

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      // Surface rate limits distinctly so the client can back off gracefully.
      const status = resp.status === 429 ? 429 : 502
      return res.status(status).json({ error: `Groq error ${resp.status}: ${detail.slice(0, 300)}` })
    }

    const data = await resp.json()
    const text = data?.choices?.[0]?.message?.content ?? 'Unexpected response format.'
    return res.status(200).json({ text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(502).json({ error: msg })
  }
}
