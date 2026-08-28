/**
 * Groq client
 *
 * The API key lives ONLY on the server. All calls go through the server-side
 * proxy at /api/ai/groq, which holds GROQ_API_KEY and picks the model. Groq is
 * the primary TEXT provider for the app.
 */

export async function askGroq(prompt: string, context?: string): Promise<string> {
  try {
    const res = await fetch('/api/ai/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 503) return 'No API key set. Groq is not configured on the server.'
    if (res.status === 429) return 'API error: Groq rate limit reached — please wait a moment and try again.'
    if (!res.ok) return `API error: ${data.error || res.status}`
    return data.text ?? 'Unexpected response format.'
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return `API error: ${msg}`
  }
}
