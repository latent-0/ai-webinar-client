/**
 * GET /api/integrations/drive
 * Recent files from the user's Google Drive (metadata, read-only).
 * Returns { connected:false } when Google is not connected.
 */

import { getValidAccessToken } from '../_lib/googleTokens.js'

export default async function handler(req, res) {
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
