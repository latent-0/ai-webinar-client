/**
 * Single-use token store (LLP-12 / T-06)
 *
 * Backs the magic-link flow. A token record is stored under an opaque id and
 * removed on first consumption, giving true single-use semantics. Expiry is
 * enforced by the store (KV TTL, or timestamp check in memory).
 *
 * Three backends, auto-selected in priority order:
 *  - Vercel KV / Upstash Redis (durable) when KV_REST_API_URL and
 *    KV_REST_API_TOKEN are present.
 *  - Supabase (durable) when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
 *    present — reuses the project's existing Postgres, no extra service needed.
 *  - In-memory Map (dev only) otherwise. Not shared across serverless
 *    instances, so magic links will not resolve reliably — fine for `vite`
 *    local dev, never for a real deployment (documented in AUTH.md).
 */

import { MAGIC_LINK_TTL_SEC } from './auth.js'
import { getServiceClient, supabaseConfigured } from './supabase.js'

const KV_URL = process.env.KV_REST_API_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN

export function usingDurableStore() {
  return Boolean(KV_URL && KV_TOKEN)
}

/** Supabase is used as the durable store when KV is not configured. */
export function usingSupabaseStore() {
  return !usingDurableStore() && supabaseConfigured()
}

// ── Upstash/Vercel KV REST helpers ───────────────────────────────────────────

async function kvCommand(command) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })
  if (!res.ok) throw new Error(`KV error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.result
}

// ── In-memory fallback ───────────────────────────────────────────────────────

/** @type {Map<string, { value: string, expiresAt: number }>} */
const memory = new Map()

function memGet(key) {
  const rec = memory.get(key)
  if (!rec) return null
  if (rec.expiresAt < Date.now()) {
    memory.delete(key)
    return null
  }
  return rec.value
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Persist a token record with a TTL. `value` should be a JSON string.
 */
export async function putToken(id, value, ttlSec = MAGIC_LINK_TTL_SEC) {
  if (usingDurableStore()) {
    await kvCommand(['SET', `magic:${id}`, value, 'EX', String(ttlSec)])
    return
  }
  if (usingSupabaseStore()) {
    const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString()
    const { error } = await getServiceClient()
      .from('magic_tokens')
      .upsert({ id, value, expires_at: expiresAt })
    if (error) throw new Error(`Supabase token store error: ${error.message}`)
    return
  }
  memory.set(`magic:${id}`, { value, expiresAt: Date.now() + ttlSec * 1000 })
}

/**
 * Atomically consume a token: return its value and delete it so it can never
 * be used again. Returns null if the token is missing, expired, or already
 * consumed.
 */
export async function consumeToken(id) {
  const key = `magic:${id}`
  if (usingDurableStore()) {
    const value = await kvCommand(['GET', key])
    if (value == null) return null
    await kvCommand(['DEL', key])
    return value
  }
  if (usingSupabaseStore()) {
    // Atomic single-use: delete the row and return it, but only if unexpired.
    const nowIso = new Date().toISOString()
    const { data, error } = await getServiceClient()
      .from('magic_tokens')
      .delete()
      .eq('id', id)
      .gt('expires_at', nowIso)
      .select('value')
    if (error) throw new Error(`Supabase token store error: ${error.message}`)
    const row = Array.isArray(data) ? data[0] : null
    return row ? row.value : null
  }
  const value = memGet(key)
  if (value == null) return null
  memory.delete(key)
  return value
}
