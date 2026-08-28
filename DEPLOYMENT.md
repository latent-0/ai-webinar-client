# Deployment & Environments

Covers **LLP-110** (dev / staging environments) and **LLP-12** (auth env vars).

The app is a Vite + React SPA with Vercel serverless functions under `/api`.
Hosting is Vercel. There is **no separate server to run** — the static build and
the functions deploy together.

---

## Environments

| Environment | Purpose | Git branch | Vercel env | Stability |
|-------------|---------|------------|------------|-----------|
| **Development** | Internal deploy for the team to test & review | `main` (and `claude/*` preview branches) | Preview / Development | Moves fast, may break |
| **Staging** | Stable environment the client uses for their own review & demo | `staging` | Production (on a dedicated staging project) or a `staging` branch alias | Kept stable; only promoted, tested builds |
| **Production** | (When the client goes live) | `production` tag/branch | Production | Locked down |

### How Vercel maps branches → environments

- Every push to any branch gets an automatic **Preview deployment** with a unique
  URL. That covers the "working dev environment to deploy, test and internal
  review" requirement — each `claude/*` branch and each PR gets its own URL.
- The **Production** deployment tracks one branch (the "Production Branch" set in
  Vercel → Settings → Git). For a stable client-facing staging URL, use one of:
  1. **Two Vercel projects** pointing at the same repo — a `sandbox-dev` project
     (Production Branch = `main`) and a `sandbox-staging` project (Production
     Branch = `staging`). Cleanest separation of env vars and stability. **(recommended)**
  2. **One project + branch alias** — assign a stable domain (e.g.
     `staging.yourdomain.com`) to the `staging` branch's deployment via Vercel
     domain settings.

### Promotion flow

```
feature branch ──PR──▶ main (dev) ──promote──▶ staging (client review) ──▶ production
```

Only promote a build to `staging` after it has been reviewed on a dev/preview URL.

---

## ⚠️ Manual steps (require the Vercel dashboard — cannot be done from code)

These need an account owner in the Vercel dashboard:

1. **Create the staging target** — either a second Vercel project
   (`sandbox-staging`) or a stable domain alias for the `staging` branch
   (options above).
2. **Set environment variables per environment** (Settings → Environment
   Variables), scoping each to Development / Preview / Production as needed. See
   the variable list below and `.env.example`.
3. **Create the `staging` branch** and set each project's Production Branch
   accordingly.
4. **(For auth)** provision Vercel KV and the email/OAuth providers (below).

Once the projects exist, everything else is automatic on `git push`.

---

## Environment variables

All server-side variables (everything **not** prefixed `VITE_`) are set in Vercel,
never committed. See `.env.example` for the full annotated list.

### Frontend (browser — safe to expose)
Only non-secret values. Anything `VITE_`-prefixed is inlined into the client
bundle and readable by anyone: `VITE_JITSI_DOMAIN`.

### AI provider keys (server-side only — LLP-129)
Reached only through the `/api/ai/*` proxies; **never** prefix with `VITE_`.
| Var | Notes |
|-----|-------|
| `ANTHROPIC_API_KEY` | Claude proxy (`/api/ai/claude`) |
| `GEMINI_API_KEY` | Gemini proxy (`/api/ai/gemini`) |
| `ELEVENLABS_API_KEY` | Speech-to-text proxy (`/api/ai/elevenlabs`) |
| `RUNWAY_API_KEY` | Image/video proxy (`/api/ai/runway`) |

### Auth backend (server-side only — LLP-12)
| Var | Required? | Notes |
|-----|-----------|-------|
| `AUTH_SECRET` | **Yes** to enable auth | `openssl rand -hex 32`. Different per environment. |
| `ALLOWED_EMAIL_DOMAINS` / `ALLOWED_EMAILS` | Recommended | Restrict who can sign in. Blank = allow all (dev only). |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | **Yes** for prod/staging | Vercel KV. Without it, tokens use an in-memory store that is not reliable across serverless instances. |
| `RESEND_API_KEY` | **Yes** to send email | Without it, magic links are returned in the API response (dev mode) instead of emailed. |
| `AUTH_EMAIL_FROM` | Optional | Verified sender address. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Enables "Continue with Google". Add the callback URL (below) to the OAuth client. |
| `PUBLIC_BASE_URL` | Optional | Overrides the link host for custom staging domains. |

### Google OAuth callback URLs to register
Add one per environment in the Google Cloud OAuth client:
```
https://<dev-url>/api/auth/google/callback
https://<staging-url>/api/auth/google/callback
```

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in what you need
npm run dev                  # Vite dev server (frontend only)
```

To exercise the `/api` serverless functions locally, use the Vercel CLI:

```bash
npm i -g vercel
vercel dev                   # serves frontend + /api together
```

In local/dev mode without `RESEND_API_KEY`, requesting a magic link returns a
`devLink` in the JSON response (and logs it) so you can complete sign-in without
an email provider.

---

## Build

```bash
npm run build   # tsc + vite build → dist/
```

Vercel runs this automatically on push. The `/api` functions are deployed as
Node serverless functions; the SPA rewrite in `vercel.json` excludes `/api/*` so
function routes are not swallowed by the client-side router.

---

## CI / CD (GitHub Actions)

Two workflows live in `.github/workflows`:

### `ci.yml` — CI (LLP-127)
Runs on every push/PR to `main` and `staging`: **lint → type-check → test → build**.
Locally the same gate is `npm run ci`. Individual steps:

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run build       # tsc && vite build
```

### `deploy.yml` — Deploy to dev/staging (LLP-126)
Deploy to a **chosen environment**:
- **Manual:** Actions → Deploy → *Run workflow* → pick `dev` or `staging` and the branch.
- **Automatic:** push to `main` → **dev** (preview), push to `staging` → **staging** (stable/production).

Required repo secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | Vercel access token |
| `VERCEL_ORG_ID` | Vercel org/team id |
| `VERCEL_PROJECT_ID_DEV` | project id for the dev environment |
| `VERCEL_PROJECT_ID_STAGING` | project id for the stable staging environment |

Until these secrets are set, the deploy workflow fails fast with a clear message
(the CI workflow needs no secrets and runs regardless). This complements Vercel's
own git auto-deploy — use it when you want to pick the target explicitly.
