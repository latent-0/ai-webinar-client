import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { Zap, Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { requestMagicLink, useAuth, type RequestLinkResult } from '../lib/authClient'

/** Read the ?auth= status the serverless routes redirect back with. */
function useAuthStatusParam(): string | null {
  const [status, setStatus] = useState<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setStatus(params.get('auth'))
  }, [])
  return status
}

const STATUS_MESSAGES: Record<string, { kind: 'ok' | 'error'; text: string }> = {
  success: { kind: 'ok', text: 'You are signed in.' },
  expired: { kind: 'error', text: 'That link has expired or was already used. Request a new one below.' },
  invalid: { kind: 'error', text: 'That sign-in link was invalid. Request a new one below.' },
  forbidden: { kind: 'error', text: 'That account is not permitted to sign in.' },
  error: { kind: 'error', text: 'Something went wrong signing you in. Please try again.' },
}

export default function SignIn() {
  const { auth, loading, signOut } = useAuth()
  const status = useAuthStatusParam()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<RequestLinkResult | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || submitting) return
    setSubmitting(true)
    setResult(null)
    try {
      setResult(await requestMagicLink(email.trim()))
    } catch {
      setResult({ ok: false, error: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const statusMsg = status ? STATUS_MESSAGES[status] : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text)] px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={15} className="text-white" />
          </div>
          <span className="text-base font-bold tracking-tight">Sandbox</span>
        </Link>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 shadow-sm">
          {statusMsg && (
            <div
              className={`mb-5 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                statusMsg.kind === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
              }`}
            >
              {statusMsg.kind === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {!loading && auth?.authenticated ? (
            <div className="text-center">
              <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-500" />
              <h1 className="text-lg font-bold mb-1">Signed in</h1>
              <p className="text-sm text-[var(--muted)] mb-6">{auth.email}</p>
              <button
                onClick={signOut}
                className="w-full py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-3)] text-sm font-semibold transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold mb-1">Sign in</h1>
              <p className="text-sm text-[var(--muted)] mb-6">
                No passwords. We&apos;ll email you a single-use link valid for 15 minutes.
              </p>

              <form onSubmit={submit} className="space-y-3">
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {submitting ? 'Sending…' : 'Email me a link'}
                  {!submitting && <ArrowRight size={15} />}
                </button>
              </form>

              {result && (
                <div className="mt-4 text-sm">
                  {result.error ? (
                    <p className="text-red-600 dark:text-red-400">{result.error}</p>
                  ) : (
                    <p className="text-emerald-700 dark:text-emerald-400">{result.message}</p>
                  )}
                  {result.devLink && (
                    <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-amber-800 dark:text-amber-300 text-xs">
                      <p className="font-semibold mb-1">Dev mode link:</p>
                      <a href={result.devLink} className="underline break-all">{result.devLink}</a>
                    </div>
                  )}
                  {result.storeWarning && (
                    <p className="mt-2 text-xs text-[var(--muted)]">{result.storeWarning}</p>
                  )}
                </div>
              )}

              {auth?.config?.google && (
                <>
                  <div className="my-5 flex items-center gap-3 text-xs text-[var(--muted)]">
                    <div className="flex-1 h-px bg-[var(--border)]" />
                    or
                    <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>
                  <a
                    href="/api/auth/google/start"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-3)] text-sm font-semibold transition-colors"
                  >
                    Continue with Google
                  </a>
                </>
              )}

              {!loading && auth && !auth.config.auth && (
                <p className="mt-5 text-xs text-[var(--muted)] text-center">
                  Auth is not fully configured on this environment yet.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
