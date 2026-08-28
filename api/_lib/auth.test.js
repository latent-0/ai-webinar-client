import { describe, it, expect } from 'vitest'
import { signToken, verifyToken, isEmailAllowed, isValidEmail } from './auth.js'

describe('auth token + allowlist (LLP-12)', () => {
  it('signs and verifies a token round-trip', () => {
    const t = signToken({ email: 'a@b.com' }, 60)
    expect(verifyToken(t)?.email).toBe('a@b.com')
  })

  it('rejects a tampered token', () => {
    const t = signToken({ email: 'a@b.com' }, 60)
    expect(verifyToken(t + 'x')).toBeNull()
  })

  it('rejects an expired token', () => {
    expect(verifyToken(signToken({ email: 'x@y.com' }, -1))).toBeNull()
  })

  it('validates email shape', () => {
    expect(isValidEmail('kunal@napkin.ie')).toBe(true)
    expect(isValidEmail('not-an-email')).toBe(false)
  })

  it('allows any valid email when no allowlist is set', () => {
    delete process.env.ALLOWED_EMAILS
    delete process.env.ALLOWED_EMAIL_DOMAINS
    expect(isEmailAllowed('anyone@example.com')).toBe(true)
  })

  it('enforces a domain allowlist when set', () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'napkin.ie'
    expect(isEmailAllowed('kunal@napkin.ie')).toBe(true)
    expect(isEmailAllowed('someone@evil.com')).toBe(false)
    delete process.env.ALLOWED_EMAIL_DOMAINS
  })
})
