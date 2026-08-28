/**
 * Gemini client (LLP-129)
 *
 * The API key is NO LONGER in the frontend. All calls go through the
 * server-side proxy at /api/ai/gemini, which holds GEMINI_API_KEY. The prompt
 * is built here and sent to the proxy to run.
 */

async function generate(prompt: string): Promise<string> {
  try {
    const res = await fetch('/api/ai/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 503) return 'No API key set. Gemini is not configured on the server.'
    if (!res.ok) return `API error: ${data.error || res.status}`
    return data.text ?? ''
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return `API error: ${msg}`
  }
}

export async function askGemini(prompt: string, context?: string): Promise<string> {
  const fullPrompt = context
    ? `You are an AI assistant for the Sandbox platform. Context: ${context}\n\nUser question: ${prompt}\n\nProvide a concise, helpful response.`
    : `You are an AI assistant for the Sandbox learning platform. Answer this question concisely and helpfully: ${prompt}`
  return generate(fullPrompt)
}

export async function generateWebinarSummary(questions: string[]): Promise<string> {
  return generate(`Summarize these webinar questions into key themes and insights:\n${questions.join('\n')}`)
}

export async function generateLearningPath(topic: string): Promise<string> {
  return generate(
    `Create a concise 5-step learning path for: "${topic}". Format as numbered steps with brief descriptions. Be practical and actionable.`,
  )
}
