/**
 * Integrations client — Google Calendar + Drive (read-only).
 *
 * Thin, same-origin fetch wrappers over /api/integrations/*. All endpoints
 * degrade gracefully: when Google isn't configured or connected they return
 * `connected: false` with empty data rather than throwing, so callers can show
 * a Connect prompt instead of an error.
 */

/** Kick off the OAuth connect flow (grants Calendar + Drive read scopes). */
export const GOOGLE_CONNECT_URL = '/api/auth/google/start?flow=connect'

export interface IntegrationStatus {
  google: { configured: boolean; connected: boolean }
}

export interface CalendarEvent {
  id: string
  title: string
  start: string | null
  allDay: boolean
  location: string | null
  url: string | null
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  url: string | null
  icon: string | null
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  try {
    const r = await fetch('/api/integrations/google?action=status', { credentials: 'same-origin' })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } catch {
    return { google: { configured: false, connected: false } }
  }
}

export async function getCalendarEvents(): Promise<{ connected: boolean; events: CalendarEvent[] }> {
  try {
    const r = await fetch('/api/integrations/google?action=calendar', { credentials: 'same-origin' })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } catch {
    return { connected: false, events: [] }
  }
}

export async function getDriveFiles(): Promise<{ connected: boolean; files: DriveFile[] }> {
  try {
    const r = await fetch('/api/integrations/google?action=drive', { credentials: 'same-origin' })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } catch {
    return { connected: false, files: [] }
  }
}

export async function disconnectGoogle(): Promise<void> {
  try {
    await fetch('/api/integrations/google?action=disconnect', { method: 'POST', credentials: 'same-origin' })
  } catch { /* best-effort */ }
}
