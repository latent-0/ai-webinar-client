/**
 * ElevenLabs client (LLP-129)
 *
 * The API key is NO LONGER in the frontend. Audio is POSTed to the server-side
 * proxy at /api/ai/elevenlabs, which holds ELEVENLABS_API_KEY and forwards the
 * transcription request.
 */

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const res = await fetch('/api/ai/elevenlabs', {
    method: 'POST',
    headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
    body: audioBlob,
  })

  if (res.status === 503) {
    return 'No ElevenLabs API key set. ElevenLabs is not configured on the server.'
  }
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return (data.text as string) || ''
}
