#!/usr/bin/env node
/**
 * Secret-leak check (LLP-26 / T-20)
 *
 * Asserts that no provider key or integration credential can reach the client:
 *   1. The built client bundle (dist/) must not contain any known key pattern.
 *   2. It must not reference the client-exposed key env-var NAMES that were
 *      removed in LLP-129 (guards against anyone re-adding VITE_*_API_KEY).
 *   3. If real key values are present in the environment at check time, their
 *      literal values must not appear anywhere in dist/.
 *   4. Source must not log provider key env vars (no-key-in-logs).
 *
 * Exits non-zero (failing the build) on any violation. Run after `vite build`.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DIST = join(ROOT, 'dist')

/** Recursively collect files under a dir, filtered by extension list. */
function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, exts, out)
    else if (exts.some((e) => name.endsWith(e))) out.push(p)
  }
  return out
}

const violations = []

// ── 1 & 2 & 3: scan the built bundle ─────────────────────────────────────────
if (!existsSync(DIST)) {
  console.error('✗ dist/ not found — run `npm run build` before the secret check.')
  process.exit(1)
}

// Known credential shapes. Kept specific to avoid false positives on hashes.
const KEY_PATTERNS = [
  { label: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { label: 'Google/Gemini API key', re: /AIza[0-9A-Za-z_-]{30,}/ },
  { label: 'ElevenLabs API key', re: /\bsk_[a-f0-9]{40,}\b/ },
  { label: 'OpenAI-style key', re: /\bsk-[A-Za-z0-9]{40,}\b/ },
]

// Env-var NAMES that must never appear in client code (removed in LLP-129).
const FORBIDDEN_CLIENT_VARS = [
  'VITE_ANTHROPIC_API_KEY',
  'VITE_GEMINI_API_KEY',
  'VITE_RUNWAY_API_KEY',
  'VITE_ELEVENLABS_API_KEY',
]

// Real key values that, if configured, must not leak into the bundle.
const SECRET_ENV_VALUES = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'RUNWAY_API_KEY',
  'ELEVENLABS_API_KEY',
  'AUTH_SECRET',
  'RESEND_API_KEY',
  'KV_REST_API_TOKEN',
  'GOOGLE_CLIENT_SECRET',
]
  .map((name) => ({ name, value: process.env[name] }))
  .filter((e) => e.value && e.value.length >= 8)

const bundleFiles = walk(DIST, ['.js', '.css', '.html', '.map'])
for (const file of bundleFiles) {
  const rel = file.slice(ROOT.length + 1)
  const text = readFileSync(file, 'utf8')

  for (const { label, re } of KEY_PATTERNS) {
    if (re.test(text)) violations.push(`${label} pattern found in ${rel}`)
  }
  for (const varName of FORBIDDEN_CLIENT_VARS) {
    if (text.includes(varName)) {
      violations.push(`Client-exposed key var "${varName}" referenced in ${rel} (must be server-side — see LLP-129)`)
    }
  }
  for (const { name, value } of SECRET_ENV_VALUES) {
    if (text.includes(value)) violations.push(`Literal value of ${name} leaked into ${rel}`)
  }
}

// ── 4: no provider-key env vars written to logs in source ─────────────────────
const LOG_LEAK = /console\.[a-z]+\([^)]*process\.env\.(ANTHROPIC_API_KEY|GEMINI_API_KEY|RUNWAY_API_KEY|ELEVENLABS_API_KEY|AUTH_SECRET|RESEND_API_KEY|KV_REST_API_TOKEN|GOOGLE_CLIENT_SECRET)/
for (const dir of ['src', 'api']) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) continue
  for (const file of walk(abs, ['.ts', '.tsx', '.js', '.mjs'])) {
    if (file.includes('.test.')) continue
    const text = readFileSync(file, 'utf8')
    if (LOG_LEAK.test(text)) violations.push(`Possible key logged in ${file.slice(ROOT.length + 1)}`)
  }
}

// ── report ───────────────────────────────────────────────────────────────────
if (violations.length) {
  console.error('✗ Secret-leak check FAILED:')
  for (const v of violations) console.error(`  - ${v}`)
  process.exit(1)
}

console.log(`✓ Secret-leak check passed (${bundleFiles.length} bundle files scanned, ${SECRET_ENV_VALUES.length} live key value(s) verified absent).`)
