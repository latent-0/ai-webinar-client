/**
 * Unified AI provider module (T-12, T-13, T-15, LLP-102)
 *
 * Provides a single `ask()` entry-point that:
 *  - Enforces an `allowedProviders` privacy guardrail
 *  - Routes to the correct model tier for each provider
 *  - Automatically fails over to the other provider on error
 *  - Returns a structured { answer, provider, usedFallback } result
 */

export type ModelTier = 'judgement' | 'fast'
export type ProviderName = 'groq' | 'claude' | 'gemini'

export const MODEL_ROUTING: Record<ProviderName, Record<ModelTier, string>> = {
  // Groq's model is chosen server-side (GROQ_MODEL) to keep it inside rate
  // limits; these ids are nominal and are NOT sent to the proxy.
  groq: {
    judgement: 'openai/gpt-oss-20b',
    fast: 'openai/gpt-oss-20b',
  },
  claude: {
    judgement: 'claude-opus-4-8',
    fast: 'claude-haiku-4-5-20251001',
  },
  gemini: {
    judgement: 'gemini-2.5-flash',
    fast: 'gemini-2.5-flash',
  },
}

export interface AskOptions {
  /** Surrounding context injected into the system prompt */
  context?: string
  /** Model tier — 'judgement' for high-quality, 'fast' for low-latency */
  tier?: ModelTier
  /**
   * Privacy guardrail: only providers in this list may be called.
   * Defaults to both ['claude', 'gemini'].
   * Throws immediately if the list is empty.
   */
  allowedProviders?: ProviderName[]
  /** Override the model ID that MODEL_ROUTING would select */
  overrideModelId?: string
}

export interface AskResult {
  answer: string
  provider: ProviderName
  usedFallback: boolean
}

/**
 * Call a single provider and return its text response.
 * Throws on API errors or missing API keys so callers can handle failover.
 */
async function callProvider(
  provider: ProviderName,
  prompt: string,
  context: string | undefined,
  tier: ModelTier,
  overrideModelId?: string,
): Promise<string> {
  if (provider === 'groq') {
    // The proxy picks the model server-side, so overrideModelId (a claude/gemini
    // id from the UI preference) is intentionally ignored here.
    const { askGroq } = await import('./groq')
    const result = await askGroq(prompt, context)
    if (result.startsWith('No API key') || result.startsWith('API error:')) {
      throw new Error(result)
    }
    return result
  }

  if (provider === 'claude') {
    const { askClaude } = await import('./claude')
    const modelId = overrideModelId ?? MODEL_ROUTING.claude[tier]
    const result = await askClaude(prompt, context, modelId)
    if (result.startsWith('No API key') || result.startsWith('API error:')) {
      throw new Error(result)
    }
    return result
  }

  // provider === 'gemini'
  const { askGemini } = await import('./gemini')
  const result = await askGemini(prompt, context)
  if (result.startsWith('No API key') || result.startsWith('API error:')) {
    throw new Error(result)
  }
  return result
}

/**
 * Ask an AI question with automatic failover.
 *
 * @param prompt   The user-visible question or instruction
 * @param options  Routing, privacy, and context options
 * @returns        { answer, provider, usedFallback }
 * @throws         If no providers are allowed, or if every allowed provider fails
 */
export async function ask(prompt: string, options: AskOptions = {}): Promise<AskResult> {
  const {
    context,
    tier = 'fast',
    allowedProviders = ['groq', 'gemini', 'claude'],
    overrideModelId,
  } = options

  if (allowedProviders.length === 0) {
    throw new Error('No AI providers are allowed by the current privacy settings.')
  }

  // Validate that requested providers are known
  const knownProviders: ProviderName[] = ['groq', 'claude', 'gemini']
  for (const p of allowedProviders) {
    if (!knownProviders.includes(p)) {
      throw new Error(`Unknown provider "${p}" in allowedProviders.`)
    }
  }

  // Determine call order: first in allowedProviders list is primary
  const [primary, ...rest] = allowedProviders
  const fallback = rest[0] as ProviderName | undefined

  // --- Primary attempt ---
  try {
    const answer = await callProvider(primary, prompt, context, tier, overrideModelId)
    return { answer, provider: primary, usedFallback: false }
  } catch (primaryErr) {
    console.warn(`[ai] Primary provider "${primary}" failed:`, primaryErr)
  }

  // --- Fallback attempt ---
  if (fallback) {
    try {
      const answer = await callProvider(fallback, prompt, context, tier)
      return { answer, provider: fallback, usedFallback: true }
    } catch (fallbackErr) {
      console.warn(`[ai] Fallback provider "${fallback}" also failed:`, fallbackErr)
    }
  }

  throw new Error(
    'AI service temporarily unavailable. Your work is saved — please try again.',
  )
}
