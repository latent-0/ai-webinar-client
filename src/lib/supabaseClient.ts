/**
 * Browser Supabase client (LLP-74)
 *
 * Uses the PUBLIC anon key (safe to expose — it is protected by Row Level
 * Security). Used only for realtime subscriptions so participants see a poll
 * reveal instantly. All privileged writes go through /api/live/poll, never the
 * anon client.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL || ''
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

let client: SupabaseClient | null = null

export function supabaseEnabled(): boolean {
  return Boolean(URL && ANON_KEY)
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled()) return null
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  }
  return client
}
