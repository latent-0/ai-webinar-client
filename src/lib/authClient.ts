/**
 * Auth client (LLP-12 / T-06)
 *
 * Thin fetch wrappers around the /api/auth serverless routes, plus a tiny
 * React hook for reading the current session. All calls are same-origin and
 * rely on the httpOnly session cookie — the token is never exposed to JS.
 */

import { useEffect, useState } from 'react'

export interface AuthState {
  authenticated: boolean
  email: string | null
  method: string | null
  config: { auth: boolean; google: boolean }
}

export interface RequestLinkResult {
  ok: boolean
  message?: string
  error?: string
  devLink?: string
  note?: string
  storeWarning?: string
}

export async function requestMagicLink(email: string): Promise<RequestLinkResult> {
  const res = await fetch('/api/auth/request-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return res.json()
}

export async function fetchSession(): Promise<AuthState> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (!res.ok) throw new Error(String(res.status))
    return res.json()
  } catch {
    return { authenticated: false, email: null, method: null, config: { auth: false, google: false } }
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
}

/** React hook: load and expose the current auth session. */
export function useAuth() {
  const [state, setState] = useState<AuthState | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    setState(await fetchSession())
    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  return {
    auth: state,
    loading,
    refresh,
    signOut: async () => { await logout(); await refresh() },
  }
}
