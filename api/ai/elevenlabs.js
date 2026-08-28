/**
 * POST /api/ai/elevenlabs  (LLP-129)
 *
 * Server-side proxy for ElevenLabs speech-to-text. The key (ELEVENLABS_API_KEY)
 * stays on the server. The browser POSTs the raw audio bytes as the request
 * body; this endpoint forwards them as multipart to ElevenLabs.
 *
 * Body:    raw audio bytes (Content-Type: audio/webm or application/octet-stream)
 * 200:     { text: string }
 */

import { KEYS, requireSession, requireMethod } from '../_lib/ai.js'

// Read the raw request stream ourselves rather than a JSON parser.
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
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
    if (!r.ok) {
      return res.status(502).json({ error: `ElevenLabs error ${r.status}: ${await r.text()}` })
    }
    const data = await r.json()
    return res.status(200).json({ text: data.text || '' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(502).json({ error: msg })
  }
}
