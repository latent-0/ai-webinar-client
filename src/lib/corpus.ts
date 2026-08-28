/**
 * Shared knowledge corpus + retrieval (LLP-20 / T-14)
 *
 * A single corpus backs every agent surface (Live Q&A, Assistant, Sandbox).
 * Retrieval is centralised here so that a change to the corpus or to the
 * ranking logic affects **all** surfaces at once, with no per-surface
 * deployment — this is the core acceptance criterion of LLP-20:
 *
 *   "the same question asked in Live and in Learn ... are answered by the
 *    same service against the same corpus, and a change to retrieval
 *    affects both without separate deployment."
 *
 * The store is intentionally simple (in-memory, keyword-scored). It can later
 * be swapped for a vector store behind the same `retrieve()` signature without
 * touching any calling surface.
 */

export type RetrievalScope = 'shared' | 'sandbox'

export interface CorpusEntry {
  id: string
  /** Scopes this entry belongs to. Every entry is visible to `shared`. */
  scopes: RetrievalScope[]
  title: string
  body: string
  /** Extra keywords to boost matching beyond the title/body text. */
  keywords?: string[]
}

/**
 * The single source of truth. Editing this array (or the ranking below)
 * changes retrieval everywhere simultaneously.
 */
export const CORPUS: CorpusEntry[] = [
  {
    id: 'platform-overview',
    scopes: ['shared'],
    title: 'What the Sandbox platform is',
    body: 'Sandbox is a live, AI-assisted workspace for running sessions, learning, and building workflows. It combines real-time video (Jitsi) with an AI layer that can answer questions, summarise, and generate content.',
    keywords: ['sandbox', 'platform', 'overview', 'what is'],
  },
  {
    id: 'ai-layer',
    scopes: ['shared'],
    title: 'The AI layer and providers',
    body: 'A single unified AI service answers every surface. It routes to Claude or Gemini, fails over automatically, and honours per-session privacy guardrails (allowed providers). Model tier is either "judgement" (high quality) or "fast" (low latency).',
    keywords: ['ai', 'provider', 'claude', 'gemini', 'failover', 'model', 'privacy'],
  },
  {
    id: 'sessions',
    scopes: ['shared'],
    title: 'Live sessions and rooms',
    body: 'Facilitators create rooms with a domain (e.g. dental, law, marketing). Each session tracks token usage against a soft ceiling so costs stay predictable. When the ceiling is reached, AI assistance pauses for that room.',
    keywords: ['room', 'session', 'live', 'token', 'ceiling', 'budget', 'facilitator'],
  },
  {
    id: 'privacy',
    scopes: ['shared'],
    title: 'Privacy and data handling',
    body: 'Sessions can restrict which AI providers may be called. If a session allows only one provider, the service never contacts the other, even as a fallback. No passwords are stored; sign-in is passwordless via magic link or Google SSO.',
    keywords: ['privacy', 'gdpr', 'data', 'passwordless', 'magic link', 'sso', 'security'],
  },
  {
    id: 'sandbox-blocks',
    scopes: ['sandbox'],
    title: 'The Sandbox six-block workflow',
    body: 'A Sandbox workflow is built from six blocks: Goal, Inputs, Insight, Ideas, Make, and Present. Each block has a contextual assistant hint. Users click a block to expand it and work with a block-specific AI mentor.',
    keywords: ['goal', 'inputs', 'insight', 'ideas', 'make', 'present', 'block', 'workflow', 'mentor'],
  },
  {
    id: 'tools',
    scopes: ['sandbox'],
    title: 'Sandbox build tools',
    body: 'Build mode exposes an API playground, a prompt library, model selection, and creative tools. These let a user test AI prompts and generate content (text, images, tables) inside a session.',
    keywords: ['tools', 'playground', 'prompt', 'library', 'image', 'table', 'build mode'],
  },
]

export interface RetrievedSnippet {
  id: string
  title: string
  body: string
  score: number
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'to', 'of', 'and', 'or', 'in', 'on', 'for',
  'what', 'how', 'do', 'does', 'i', 'you', 'my', 'we', 'it', 'this', 'that',
  'with', 'can', 'will', 'about',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
}

/**
 * Retrieve the most relevant corpus snippets for a query within a scope.
 *
 * `shared` sees every entry tagged `shared`. Any other scope sees its own
 * entries **plus** the shared entries, so surfaces never diverge on the
 * common knowledge base.
 *
 * @param scope  Retrieval scope of the calling agent.
 * @param query  The user's question or instruction.
 * @param limit  Max snippets to return (default 3).
 */
export function retrieve(scope: RetrievalScope, query: string, limit = 3): RetrievedSnippet[] {
  const queryTokens = new Set(tokenize(query))
  if (queryTokens.size === 0) return []

  const visible = CORPUS.filter(
    (e) => e.scopes.includes('shared') || e.scopes.includes(scope),
  )

  const scored = visible.map((entry) => {
    const haystack = tokenize(
      `${entry.title} ${entry.body} ${(entry.keywords ?? []).join(' ')}`,
    )
    const haySet = new Set(haystack)
    let score = 0
    for (const t of queryTokens) if (haySet.has(t)) score += 1
    return { id: entry.id, title: entry.title, body: entry.body, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Format retrieved snippets as a context block for a system prompt. */
export function formatRetrieval(snippets: RetrievedSnippet[]): string {
  if (snippets.length === 0) return ''
  const lines = snippets.map((s) => `- ${s.title}: ${s.body}`)
  return `Relevant platform knowledge:\n${lines.join('\n')}`
}
