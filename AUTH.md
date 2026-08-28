# Authentication (LLP-12 / T-06)

Passwordless sign-in for facilitators. **No passwords are stored anywhere.**
Two methods: email **magic link** and **Google SSO**.

## Endpoints (Vercel serverless, `/api/auth`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/request-link` | POST `{ email }` | Create a single-use, 15-min magic link and email it. Enumeration-safe. |
| `/api/auth/consume?token=…` | GET | Validate + consume the token once, set session cookie, redirect. |
| `/api/auth/me` | GET | Current session `{ authenticated, email, method, config }`. |
| `/api/auth/logout` | POST | Clear the session cookie. |
| `/api/auth/google/start` | GET | Begin Google OAuth (302 to Google). |
| `/api/auth/google/callback` | GET | Complete Google OAuth, set session. |

The session is an HMAC-signed token (Node `crypto`, no JWT dependency) stored in
an **httpOnly, Secure, SameSite=Lax** cookie — never exposed to JavaScript.

## Acceptance criteria → implementation

- **Single-use link valid 15 minutes, consumes on first use** →
  `MAGIC_LINK_TTL_SEC = 900`; `consumeToken()` deletes the record atomically on
  first read, so a second use returns `null`. (`api/_lib/store.js`)
- **Expired or already-used link is refused with an option to request another** →
  `consume` redirects to `/signin?...&auth=expired|invalid`; the Sign-in page
  shows the error and the request-a-new-link form. (`src/pages/SignIn.tsx`)
- **No passwords** → only magic link + Google SSO; no password field or store.

## Token store & single-use semantics

- **Production/staging:** Vercel KV (Upstash Redis). Tokens are keyed
  `magic:<id>`, given a 15-min TTL, and `DEL`eted on consumption.
- **Dev fallback:** in-memory `Map` (works locally, not durable across
  serverless instances — hence KV is required for real deployments).

## Graceful degradation

Every route works even when secrets are missing, so deploying without them never
breaks the live app:

- No `AUTH_SECRET` → auth reports "not configured" via `/api/auth/me`.
- No `RESEND_API_KEY` (and not production) → the link is returned as `devLink`.
- No `GOOGLE_CLIENT_*` → `/api/auth/google/start` returns 501 and the Google
  button is hidden.
- No `KV_*` (and not production) → in-memory store with a dev warning.

See `DEPLOYMENT.md` and `.env.example` for the variables required to activate
each capability in each environment.
