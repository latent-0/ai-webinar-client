/**
 * Runway client (LLP-129)
 *
 * The API key is NO LONGER in the frontend. Generation goes through the
 * server-side proxy at /api/ai/runway, which holds RUNWAY_API_KEY. Task
 * polling still runs on the client, driven through the proxy's "task" action.
 */

/** Whether the server has a Runway key configured (no secret is exposed). */
export async function hasRunwayKey(): Promise<boolean> {
  try {
    const res = await fetch('/api/ai/config')
    if (!res.ok) return false
    const cfg = await res.json()
    return Boolean(cfg.runway)
  } catch {
    return false
  }
}

async function proxy(body: Record<string, unknown>) {
  const res = await fetch('/api/ai/runway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Runway ${res.status}`)
  return data
}

async function getTask(taskId: string) {
  return proxy({ action: 'task', taskId })
}

export async function pollTask(taskId: string, onProgress?: (pct: number) => void): Promise<string> {
  const MAX_ATTEMPTS = 120
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const task = await getTask(taskId)
    if (task.status === 'SUCCEEDED') {
      const output = task.output?.[0]
      if (!output) throw new Error('No output from Runway task')
      return output
    }
    if (task.status === 'FAILED') {
      throw new Error(task.failure || 'Runway task failed')
    }
    if (onProgress && task.progress != null) {
      onProgress(Math.round(task.progress * 100))
    }
  }
  throw new Error('Runway task timed out')
}

export async function textToImage(prompt: string): Promise<string> {
  const data = await proxy({ action: 'text_to_image', prompt })
  return pollTask(data.id)
}

export async function imageToVideo(imageUrl: string, prompt = ''): Promise<string> {
  const data = await proxy({ action: 'image_to_video', imageUrl, prompt })
  return pollTask(data.id)
}
