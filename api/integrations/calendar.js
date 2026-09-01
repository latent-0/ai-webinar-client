/**
 * GET /api/integrations/calendar
 * Upcoming events from the user's primary Google Calendar (read-only).
 * Returns { connected:false } when Google is not connected, so the UI can show
 * a Connect prompt instead of an error.
 */

import { getValidAccessToken } from '../_lib/googleTokens.js'

export default async function handler(req, res) {
  const token = await getValidAccessToken(req, res)
  if (!token) return res.status(200).json({ connected: false, events: [] })

  try {
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '10',
    })
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return res.status(200).json({ connected: true, events: [], error: `Calendar API ${r.status}` })
    const data = await r.json()
    const events = (data.items || []).map((e) => ({
      id: e.id,
      title: e.summary || '(no title)',
      start: e.start?.dateTime || e.start?.date || null,
      allDay: !e.start?.dateTime,
      location: e.location || null,
      url: e.htmlLink || null,
    }))
    return res.status(200).json({ connected: true, events })
  } catch (err) {
    return res.status(200).json({ connected: true, events: [], error: err instanceof Error ? err.message : String(err) })
  }
}
