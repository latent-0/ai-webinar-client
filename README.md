# Sandbox — Live · Learn · Play

An interactive AI-webinar / learning platform: run live sessions, browse a
knowledge hub, practise in a playground, and review analytics. Single-page web
app with a small serverless backend, hosted on Vercel. Backs the Jira project
**Live Learn Play (LLP)**.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Language | **TypeScript** (frontend), **JavaScript (ESM)** (serverless functions) |
| UI | **React 18** |
| Build tool | **Vite 5** |
| Routing | **TanStack Router** |
| State | **Zustand** (with a persistence layer) |
| Styling | **Tailwind CSS** (+ PostCSS, Autoprefixer) |
| Icons | **lucide-react** |
| Live video | **Jitsi** (`@jitsi/react-sdk`) |
| AI providers | **Anthropic Claude** & **Google Gemini** (text), **Runway** (image/video), **ElevenLabs** (speech-to-text) — all called **server-side** via `/api/ai/*` proxies |
| Backend | **Vercel serverless functions** (Node 20) under `/api` |
| Auth | Passwordless magic links + optional Google SSO (see [AUTH.md](AUTH.md)) |
| Tests | **Vitest** |
| Lint | **ESLint** |

There is **no separate server to run** — the static build and the serverless
functions deploy together on Vercel.

---

## Project structure

```
src/
  components/layout/   Shared layout/navigation components
  pages/               Route screens (Live, Learn, Play, Analytics, Canvas, …)
  lib/                 Client logic: AI clients (claude/gemini/runway/elevenlabs),
                       ai.ts (unified router + failover), auth client, corpus, IA/nav
  store/               Zustand store + persistence
api/
  _lib/                Shared server helpers (auth, ai proxy guards, store, email)
  ai/                  AI provider proxies: claude, gemini, runway, elevenlabs, config
  auth/                Auth endpoints (magic link, Google SSO, session)
scripts/
  check-secrets.mjs    Build-time secret-leak check (LLP-26)
.github/workflows/     CI (ci.yml) and Deploy (deploy.yml)
```

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in what you need
npm run dev                  # Vite dev server (frontend only)
```

To exercise the `/api` serverless functions locally, use the Vercel CLI (it
serves the frontend and functions together):

```bash
npm i -g vercel
vercel dev
```

### Available scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Run the Vitest suite |
| `npm run check:secrets` | Scan `dist/` for leaked keys (run after build) |
| `npm run ci` | lint → typecheck → test → build → secret-check (the full gate) |

---

## Configuration (environment variables)

All secrets live in **server-side** environment variables (never prefixed
`VITE_`, never committed) and are set in the Vercel dashboard. Only non-secret
values (e.g. `VITE_JITSI_DOMAIN`) may be exposed to the browser.

- **AI provider keys** (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `RUNWAY_API_KEY`,
  `ELEVENLABS_API_KEY`) are read only by the `/api/ai/*` proxies — they never
  reach the client bundle (see LLP-129).
- **Auth** vars (`AUTH_SECRET`, KV, email, Google OAuth) are documented in
  [AUTH.md](AUTH.md).

See [`.env.example`](.env.example) for the full annotated list and
[DEPLOYMENT.md](DEPLOYMENT.md) for how each maps to an environment.

---

## Hosting & deployment

Hosted on **Vercel**. The SPA rewrite in `vercel.json` sends all non-`/api/*`
routes to `index.html`; `/api/*` routes are served as Node serverless functions.

### Environments

| Environment | Purpose | Git branch |
|-------------|---------|-----------|
| **Development** | Internal team testing/review | `main` (+ preview branches) |
| **Staging** | Stable environment for client review/demo | `staging` |
| **Production** | Client go-live | (locked-down, when ready) |

Promotion flow: `feature branch → PR → main (dev) → staging (client review) → production`.

### CI / CD (GitHub Actions)

- **`ci.yml`** — runs on every push/PR to `main` and `staging`:
  lint → type-check → test → build → **secret-leak check**.
- **`deploy.yml`** — deploys to a chosen environment:
  - Automatic: push to `main` → dev, push to `staging` → staging.
  - Manual: **Actions → Deploy → Run workflow** and pick the environment/branch.

Deployment requires these repo secrets (**Settings → Secrets and variables →
Actions**): `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_DEV`,
`VERCEL_PROJECT_ID_STAGING`. Until they are set, the deploy job fails fast with a
clear message; CI runs regardless.

Full details, including the one-time Vercel dashboard setup, are in
[DEPLOYMENT.md](DEPLOYMENT.md).
