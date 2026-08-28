/**
 * Email delivery (LLP-12 / T-06)
 *
 * Sends the magic-link email. Uses Resend when RESEND_API_KEY is set; otherwise
 * runs in "dev mode" — it logs the link and reports back that no provider is
 * configured, so local testing works without an email account. In dev mode the
 * calling route may return the link in the JSON response (never in production).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.AUTH_EMAIL_FROM || 'Sandbox <onboarding@resend.dev>'

export function emailConfigured() {
  return Boolean(RESEND_API_KEY)
}

/**
 * Send the sign-in link.
 * @returns {Promise<{ delivered: boolean, dev: boolean }>}
 */
export async function sendMagicLink(to, link) {
  if (!RESEND_API_KEY) {
    // Dev mode — surface the link in server logs.
    console.log(`[auth] Magic link for ${to}: ${link}`)
    return { delivered: false, dev: true }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: 'Your sign-in link',
      html: renderEmail(link),
    }),
  })

  if (!res.ok) {
    throw new Error(`Email send failed ${res.status}: ${await res.text()}`)
  }
  return { delivered: true, dev: false }
}

function renderEmail(link) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="font-size: 18px;">Sign in to Sandbox</h2>
      <p style="color: #444;">Click the button below to sign in. This link is valid for 15 minutes and can be used once.</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Sign in</a>
      </p>
      <p style="color:#888;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `
}
