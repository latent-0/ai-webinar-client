/**
 * Server-side Supabase client (LLP-74)
 *
 * Uses the SERVICE ROLE key, which bypasses RLS — so all privileged writes
 * (launching polls, recording votes, revealing) go through the serverless
 * endpoints, never the browser. The service role key is server-only and must
 * NEVER be prefixed with VITE_.
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function supabaseConfigured() {
  return Boolean(URL && SERVICE_ROLE_KEY)
}

let client = null

/** Returns a service-role client, or null if Supabase is not configured. */
export function getServiceClient() {
  if (!supabaseConfigured()) return null
  if (!client) {
    client = createClient(URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
