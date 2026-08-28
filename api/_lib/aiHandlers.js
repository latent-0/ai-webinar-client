/**
 * AI provider handlers (consolidated) — LLP-129
 *
 * The per-provider proxies used to be separate files under api/ai/. They are
 * consolidated here and dispatched by the single api/ai/[provider].js dynamic
 * route, so the whole AI surface is ONE serverless function (Hobby-plan
 * function-count friendly) while keeping the same /api/ai/<provider> URLs.
 *
 * Every handler keeps its original contract, session gate, and graceful
 * "not configured" (503) behaviour.
 */

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { KEYS, requireSession, requireMethod, readJson } from './ai.js'

// ── GET /api/ai/config ────────────────────────────────────────────────────────
export function configHandler(req, res) {
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

// ── POST /api/ai/groq (primary text) ────────────────────────────────────────
const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-20b'
export async function groqHandler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!requireSession(req, res)) return

  const key = KEYS.groq()
  if (!key) return res.status(503).json({ error: 'Groq is not configured.' })

  const { prompt, context } = await readJson(req)
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'A "prompt" string is required.' })
  }

  const model = process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL
  const systemPrompt = context
    ? `You are an AI assistant for the Sandbox platform. ${context}\n\nProvide a concise, helpful response.`
    : 'You are an AI assistant for the Sandbox learning platform. Answer questions concisely and helpfully.'

  const payload = {
    model,
    max_tokens: 2048,
    temperature: 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  }
  if (model.includes('gpt-oss')) payload.reasoning_effort = 'low'

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
    })
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      const status = resp.status === 429 ? 429 : 502
      return res.status(status).json({ error: `Groq error ${resp.status}: ${detail.slice(0, 300)}` })
    }
    const data = await resp.json()
    const text = data?.choices?.[0]?.message?.content ?? 'Unexpected response format.'
    return res.status(200).json({ text })
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) })
  }
}

// ── POST /api/ai/claude (fallback text) ─────────────────────────────────────
const CLAUDE_DEFAULT_MODEL = 'claude-opus-4-8'
export async function claudeHandler(req, res) {
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
      model: typeof model === 'string' && model ? model : CLAUDE_DEFAULT_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = message.content[0]
    const text = block && block.type === 'text' ? block.text : 'Unexpected response format.'
    return res.status(200).json({ text })
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) })
  }
}

// ── POST /api/ai/gemini (fallback text) ─────────────────────────────────────
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash'
export async function geminiHandler(req, res) {
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
    const gm = genAI.getGenerativeModel({ model: typeof model === 'string' && model ? model : GEMINI_DEFAULT_MODEL })
    const result = await gm.generateContent(prompt)
    return res.status(200).json({ text: result.response.text() })
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) })
  }
}

// ── POST /api/ai/runway (image/video) ───────────────────────────────────────
const RUNWAY_BASE_URL = 'https://api.runwayml.com/v1'
const RUNWAY_VERSION = '2024-11-06'
export async function runwayHandler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!requireSession(req, res)) return

  const key = KEYS.runway()
  if (!key) return res.status(503).json({ error: 'Runway is not configured.' })

  const body = await readJson(req)
  const { action } = body
  const authHeaders = { Authorization: `Bearer ${key}`, 'X-Runway-Version': RUNWAY_VERSION }

  const post = async (path, payload) => {
    const r = await fetch(`${RUNWAY_BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!r.ok) throw new Error(`Runway ${r.status}: ${await r.text()}`)
    return r.json()
  }

  try {
    if (action === 'text_to_image') {
      if (!body.prompt) return res.status(400).json({ error: 'A "prompt" is required.' })
      return res.status(200).json(await post('/text_to_image', {
        promptText: body.prompt, model: 'gen4_image', ratio: '1280:720',
      }))
    }
    if (action === 'image_to_video') {
      if (!body.imageUrl) return res.status(400).json({ error: 'An "imageUrl" is required.' })
      return res.status(200).json(await post('/image_to_video', {
        model: 'gen4_turbo', promptImage: body.imageUrl,
        promptText: body.prompt || undefined, ratio: '1280:720', duration: 5,
      }))
    }
    if (action === 'task') {
      if (!body.taskId) return res.status(400).json({ error: 'A "taskId" is required.' })
      const r = await fetch(`${RUNWAY_BASE_URL}/tasks/${encodeURIComponent(body.taskId)}`, { headers: authHeaders })
      if (!r.ok) return res.status(502).json({ error: `Runway task fetch ${r.status}` })
      return res.status(200).json(await r.json())
    }
    return res.status(400).json({ error: `Unknown action "${action}".` })
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) })
  }
}

// ── POST /api/ai/elevenlabs (speech-to-text, raw body) ──────────────────────
export async function elevenlabsHandler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!requireSession(req, res)) return

  const key = KEYS.elevenlabs()
  if (!key) return res.status(503).json({ error: 'ElevenLabs is not configured.' })

  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)
    if (!buffer.length) return res.status(400).json({ error: 'Empty audio payload.' })

    const contentType = req.headers['content-type'] || 'audio/webm'
    const formData = new FormData()
    formData.append('file', new Blob([buffer], { type: contentType }), 'recording.webm')
    formData.append('model_id', 'scribe_v1')

    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: formData,
    })
    if (!r.ok) return res.status(502).json({ error: `ElevenLabs error ${r.status}: ${await r.text()}` })
    const data = await r.json()
    return res.status(200).json({ text: data.text || '' })
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
