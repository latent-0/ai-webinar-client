/**
 * Video backend config for a live room.
 *
 * Asks the server whether JaaS (8x8) is configured and, if so, returns a signed
 * join token + the JaaS domain/room. When JaaS isn't configured the client
 * falls back to public meet.jit.si.
 */

export interface VideoConfig {
  configured: boolean
  domain?: string
  appId?: string
  roomName?: string
  jwt?: string
}

export async function getVideoConfig(room: string, name: string): Promise<VideoConfig> {
  try {
    const r = await fetch(`/api/live/token?room=${encodeURIComponent(room)}&name=${encodeURIComponent(name)}`, {
      credentials: 'same-origin',
    })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } catch {
    return { configured: false }
  }
}
