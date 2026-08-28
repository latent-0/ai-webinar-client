/**
 * Anthropic client (LLP-129)
 *
 * The API key is NO LONGER in the frontend. All calls go through the
 * server-side proxy at /api/ai/claude, which holds ANTHROPIC_API_KEY.
 */

export const CLAUDE_MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', badge: 'Most Capable' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', badge: 'Balanced' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', badge: 'Fast' },
]

export async function askClaude(prompt: string, context?: string, model = 'claude-opus-4-8'): Promise<string> {
  try {
    const res = await fetch('/api/ai/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context, model }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 503) return 'No API key set. Anthropic is not configured on the server.'
    if (!res.ok) return `API error: ${data.error || res.status}`
    return data.text ?? 'Unexpected response format.'
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return `API error: ${msg}`
  }
}
