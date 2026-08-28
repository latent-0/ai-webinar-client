/**
 * POST /api/ai/runway  (LLP-129)
 *
 * Server-side proxy for RunwayML. The key (RUNWAY_API_KEY) stays on the server.
 * The browser drives generation through a small set of named actions; polling
 * still happens on the client via the "task" action.
 *
 * Body:
 *   { action: 'text_to_image', prompt }
 *   { action: 'image_to_video', imageUrl, prompt? }
 *   { action: 'task', taskId }
 * 200: raw Runway JSON for that action
 */

import { KEYS, requireSession, requireMethod, readJson } from '../_lib/ai.js'

const BASE_URL = 'https://api.runwayml.com/v1'
const VERSION = '2024-11-06'

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!requireSession(req, res)) return

  const key = KEYS.runway()
  if (!key) return res.status(503).json({ error: 'Runway is not configured.' })

  const body = await readJson(req)
  const { action } = body
  const authHeaders = { Authorization: `Bearer ${key}`, 'X-Runway-Version': VERSION }

  try {
    if (action === 'text_to_image') {
      if (!body.prompt) return res.status(400).json({ error: 'A "prompt" is required.' })
      const data = await post('/text_to_image', {
        promptText: body.prompt, model: 'gen4_image', ratio: '1280:720',
      }, authHeaders)
      return res.status(200).json(data)
    }

    if (action === 'image_to_video') {
      if (!body.imageUrl) return res.status(400).json({ error: 'An "imageUrl" is required.' })
      const data = await post('/image_to_video', {
        model: 'gen4_turbo', promptImage: body.imageUrl,
        promptText: body.prompt || undefined, ratio: '1280:720', duration: 5,
      }, authHeaders)
      return res.status(200).json(data)
    }

    if (action === 'task') {
      if (!body.taskId) return res.status(400).json({ error: 'A "taskId" is required.' })
      const r = await fetch(`${BASE_URL}/tasks/${encodeURIComponent(body.taskId)}`, { headers: authHeaders })
      if (!r.ok) return res.status(502).json({ error: `Runway task fetch ${r.status}` })
      return res.status(200).json(await r.json())
    }

    return res.status(400).json({ error: `Unknown action "${action}".` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(502).json({ error: msg })
  }
}

async function post(path, payload, authHeaders) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error(`Runway ${r.status}: ${await r.text()}`)
  return r.json()
}
