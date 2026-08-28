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

  // ── Google Ads expert knowledge (LLP — webinar topic) ──────────────────────
  // Practitioner-level Google Ads knowledge so the Live/Assistant agent can
  // answer attendee questions like a seasoned PPC specialist. Scoped 'shared'
  // so it surfaces in every surface via the same retrieval path.
  {
    id: 'gads-overview',
    scopes: ['shared'],
    title: 'Google Ads — what it is and how the auction works',
    body: 'Google Ads is an online advertising platform where advertisers bid on keywords to show ads across Search, Display, YouTube, Shopping, Discover, Gmail and Maps. It runs a real-time auction on every query. Where and whether your ad shows is set by Ad Rank = Bid × Quality Score, plus the expected impact of ad extensions/assets and the context of the search. You pay per click (CPC), and you almost never pay your max bid — the actual CPC is roughly the Ad Rank of the competitor below you divided by your Quality Score, plus a cent.',
    keywords: ['google ads', 'adwords', 'ppc', 'sem', 'auction', 'ad rank', 'cpc', 'bid', 'search ads', 'paid search', 'how does google ads work'],
  },
  {
    id: 'gads-quality-score',
    scopes: ['shared'],
    title: 'Quality Score and how to improve it',
    body: 'Quality Score (1–10) is Google\'s diagnostic of ad relevance, built from three parts: expected click-through rate (CTR), ad relevance (how well the ad matches the keyword intent), and landing page experience (relevance, speed, mobile-friendliness, transparency). A higher Quality Score lowers your CPC and raises your Ad Rank, so you pay less for better positions. Improve it by tightly theming ad groups (few closely-related keywords each), mirroring the keyword in the headline, using specific ad copy with a clear CTA, adding all relevant assets/extensions, and sending clicks to a fast, on-message landing page.',
    keywords: ['quality score', 'ctr', 'ad relevance', 'landing page experience', 'relevance', 'improve quality score', 'lower cpc'],
  },
  {
    id: 'gads-match-types',
    scopes: ['shared'],
    title: 'Keyword match types and negative keywords',
    body: 'Match types control how closely a search must match your keyword. Broad match reaches the widest set of related searches (and now leans on Smart Bidding and audience signals); phrase match shows for searches that include the meaning of your phrase; exact match shows for the same meaning/intent as the keyword. Modern broad match can waste spend without good conversion tracking and Smart Bidding. Negative keywords exclude irrelevant terms (e.g. "free", "jobs", competitor names) and are essential to stop wasted clicks — mine the Search Terms report weekly and add negatives. Structure: exact/phrase for control, broad only with Smart Bidding + a solid negative list.',
    keywords: ['match type', 'broad match', 'phrase match', 'exact match', 'negative keywords', 'search terms report', 'keywords'],
  },
  {
    id: 'gads-campaign-types',
    scopes: ['shared'],
    title: 'Campaign types and when to use each',
    body: 'Search (text ads on results — high intent, best for lead gen and direct response). Performance Max (goal-based, AI serves across all Google inventory from one campaign using asset groups and audience signals — strong for ecommerce and lead gen but a "black box", protect brand with exclusions). Shopping (product ads driven by the Merchant Center feed — core for ecommerce). Display (banner/image ads across the GDN — awareness and remarketing). Video/YouTube (awareness, consideration, and action formats). Demand Gen (visually rich social-style ads on YouTube, Discover, Gmail). Rule of thumb: capture existing demand with Search/Shopping first, then scale with Performance Max and generate demand with Video/Demand Gen.',
    keywords: ['campaign type', 'performance max', 'pmax', 'shopping', 'display', 'youtube', 'video', 'demand gen', 'search campaign', 'gdn'],
  },
  {
    id: 'gads-bidding',
    scopes: ['shared'],
    title: 'Bidding strategies (Smart Bidding)',
    body: 'Manual CPC gives full control but does not scale. Smart Bidding uses Google\'s AI with conversion data: Maximize Conversions (get the most conversions for the budget), Target CPA (tCPA — hit a cost-per-acquisition), Maximize Conversion Value, and Target ROAS (tROAS — hit a return-on-ad-spend target, e.g. 400%). Maximize Clicks is for traffic, Target Impression Share for visibility/brand defence. Smart Bidding needs reliable conversion tracking and ideally ~15–30+ conversions/month to learn. Start on Maximize Conversions, then move to tCPA/tROAS once you have data; change targets gradually (±10–15%) to avoid resetting the learning phase.',
    keywords: ['bidding', 'smart bidding', 'target cpa', 'tcpa', 'target roas', 'troas', 'maximize conversions', 'manual cpc', 'bid strategy', 'roas', 'cpa'],
  },
  {
    id: 'gads-conversion-tracking',
    scopes: ['shared'],
    title: 'Conversion tracking and measurement',
    body: 'Conversion tracking is the foundation of everything — Smart Bidding, optimisation and ROI reporting are only as good as the conversion data. Set it up via a Google tag / Google Tag Manager, import GA4 conversions, or use offline conversion import (upload CRM sales via GCLID) for lead-gen where the real value happens after the click. Define which actions count as primary (purchases, qualified leads) vs secondary. Use Enhanced Conversions to recover measurement lost to cookie/consent gaps. Track value, not just volume, so bidding can optimise to revenue. Watch for double-counting and only mark high-quality actions as primary conversions.',
    keywords: ['conversion tracking', 'conversions', 'ga4', 'gtm', 'google tag', 'enhanced conversions', 'offline conversion', 'gclid', 'measurement', 'attribution'],
  },
  {
    id: 'gads-structure',
    scopes: ['shared'],
    title: 'Account structure and ad copy best practice',
    body: 'Structure: Account → Campaigns (by budget, goal, geo, or product line) → Ad Groups (tightly themed, ideally one intent each) → Keywords + Responsive Search Ads (RSAs). Give each RSA up to 15 headlines and 4 descriptions, pin sparingly (e.g. brand in H1), include the keyword and a clear benefit + CTA, and aim for "Good"/"Excellent" Ad Strength. Add every relevant asset (sitelinks, callouts, structured snippets, call, lead form, image, price, promotion) — assets lift CTR and Ad Rank at no extra cost. Keep budgets aligned to priority campaigns and avoid too many ad groups competing for the same terms.',
    keywords: ['account structure', 'ad group', 'responsive search ads', 'rsa', 'headlines', 'ad copy', 'ad strength', 'assets', 'extensions', 'sitelinks', 'best practice'],
  },
  {
    id: 'gads-metrics-optimization',
    scopes: ['shared'],
    title: 'Key metrics and optimisation workflow',
    body: 'Core metrics: Impressions, CTR, CPC, Conversions, Conversion Rate (CVR), CPA, ROAS, and Impression Share (plus IS lost to budget vs rank). Diagnose with them: low CTR → weak ad/relevance; high CTR but low CVR → landing page or targeting/offer mismatch; high CPA → bids, keywords or Quality Score; IS lost to budget → raise budget on winners. Weekly optimisation loop: review Search Terms and add negatives, pause wasteful keywords/asset groups, reallocate budget to top ROAS/CPA performers, test new RSAs and assets, and let Smart Bidding gather data before judging (respect the ~1–2 week learning phase). Optimise to business outcomes (revenue/qualified leads), not vanity clicks.',
    keywords: ['metrics', 'kpi', 'ctr', 'conversion rate', 'cvr', 'cpa', 'roas', 'impression share', 'optimization', 'optimisation', 'wasted spend', 'reporting', 'performance'],
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
