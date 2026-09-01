/**
 * Google integrations (Calendar + Drive), read-only.
 *
 * One serverless function, routed by ?action= to stay within the Vercel Hobby
 * 12-function limit:
 *   GET  ?action=status      → { google: { configured, connected } }
 *   GET  ?action=calendar    → upcoming events from the primary calendar
 *   GET  ?action=drive       → recent Drive files (metadata)
 *   POST ?action=disconnect  → revoke + clear the integration cookie
 *
 * calendar/drive return { connected:false } when Google isn't connected, so the
 * UI can show a Connect prompt instead of an error.
 */

import {
  googleConfigured, isConnected, getValidAccessToken, readTokens, clearTokenCookie,
} from '../_lib/googleTokens.js'

export default async function handler(req, res) {
  const action = String(req.query?.action || 'status')

  if (action === 'status') {
    return res.status(200).json({ google: { configured: googleConfigured(), connected: isConnected(req) } })
  }

  if (action === 'disconnect') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method not allowed.' })
    }
    const bundle = readTokens(req)
    const token = bundle?.refresh_token || bundle?.access_token
    if (token) {
      try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }) } catch { /* best-effort */ }
    }
    res.setHeader('Set-Cookie', clearTokenCookie())
    return res.status(200).json({ ok: true })
  }

  if (action === 'calendar') {
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

  if (action === 'drive') {
    const token = await getValidAccessToken(req, res)
    if (!token) return res.status(200).json({ connected: false, files: [] })
    try {
      const params = new URLSearchParams({
        pageSize: '15',
        orderBy: 'modifiedTime desc',
        q: 'trashed = false',
        fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink)',
      })
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) return res.status(200).json({ connected: true, files: [], error: `Drive API ${r.status}` })
      const data = await r.json()
      const files = (data.files || []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        url: f.webViewLink || null,
        icon: f.iconLink || null,
      }))
      return res.status(200).json({ connected: true, files })
    } catch (err) {
      return res.status(200).json({ connected: true, files: [], error: err instanceof Error ? err.message : String(err) })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(400).json({ error: 'Unknown action.' })
}
