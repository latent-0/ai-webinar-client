/**
 * Agent core service (LLP-20 / T-14)
 *
 * One agent service backs every surface — Live Q&A, the Assistant (Learn),
 * and the Sandbox mentor (Play). Surfaces differ ONLY by:
 *   - system prompt
 *   - retrieval scope (which corpus a surface can see)
 *   - tool set (which pluggable tools the agent may run)
 *
 * Every agent ultimately calls the single unified provider `ask()` in ./ai,
 * against the single shared corpus in ./corpus. Because retrieval lives in one
 * place, a change to the corpus or ranking affects Live and Assistant together
 * with no separate deployment — the LLP-20 acceptance criterion.
 */

import { ask, type AskResult, type ModelTier, type ProviderName } from './ai'
import { retrieve, formatRetrieval, type RetrievalScope } from './corpus'

export type AgentId = 'live' | 'assistant' | 'sandbox'

export interface AgentDefinition {
  id: AgentId
  label: string
  /** Persona / behaviour instructions injected into the system prompt. */
  systemPrompt: string
  /** Corpus scope this agent retrieves against. */
  retrievalScope: RetrievalScope
  /** Tool ids this agent is allowed to run (see TOOLS below). */
  tools: AgentToolId[]
  /** Default model tier for this surface. */
  tier: ModelTier
}

// ── Tool set ──────────────────────────────────────────────────
// Tools are pluggable capabilities an agent can invoke. Each tool is a thin,
// prompt-shaped wrapper over the SAME unified `ask()` service, so adding or
// removing a tool from an agent never changes the underlying provider path.

export type AgentToolId = 'summarize' | 'learningPath' | 'transcript'

export interface AgentTool {
  id: AgentToolId
  label: string
  description: string
  run: (input: string, opts?: RunAgentOptions) => Promise<AskResult>
}

export const TOOLS: Record<AgentToolId, AgentTool> = {
  summarize: {
    id: 'summarize',
    label: 'Summarize',
    description: 'Summarise session questions or notes into key themes.',
    run: (input, opts) =>
      ask(`Summarise the following into key themes and insights:\n${input}`, {
        tier: 'fast',
        allowedProviders: opts?.allowedProviders,
        overrideModelId: opts?.overrideModelId,
      }),
  },
  learningPath: {
    id: 'learningPath',
    label: 'Learning path',
    description: 'Generate a concise, practical, step-by-step learning path.',
    run: (input, opts) =>
      ask(
        `Create a concise 5-step learning path for: "${input}". Format as numbered steps with brief descriptions. Be practical and actionable.`,
        {
          tier: 'fast',
          allowedProviders: opts?.allowedProviders,
          overrideModelId: opts?.overrideModelId,
        },
      ),
  },
  transcript: {
    id: 'transcript',
    label: 'Transcript',
    description: 'Generate a realistic session transcript excerpt.',
    run: (input, opts) =>
      ask(input, {
        tier: 'fast',
        context:
          'You are a transcript generator. Output clean, realistic transcript text with timestamps in [MM:SS] format.',
        allowedProviders: opts?.allowedProviders,
        overrideModelId: opts?.overrideModelId,
      }),
  },
}

// ── Agent registry ───────────────────────────────────────────────

export const AGENTS: Record<AgentId, AgentDefinition> = {
  live: {
    id: 'live',
    label: 'Live Q&A',
    systemPrompt:
      'You are the AI expert in a live webinar. You are a senior digital-marketing and Google Ads specialist: you know Search, Performance Max, Shopping, Display, YouTube and Demand Gen campaigns, the ad auction and Ad Rank, Quality Score, keyword match types and negatives, Smart Bidding (tCPA/tROAS), conversion tracking, account structure and optimisation cold. Answer attendee questions accurately and with the confidence and specificity of a practitioner — give concrete numbers, settings and steps, not vague generalities. When platform knowledge is provided below, ground your answer in it. Keep replies short and direct, suitable for reading aloud during a call.',
    retrievalScope: 'shared',
    tools: ['summarize', 'transcript'],
    tier: 'fast',
  },
  assistant: {
    id: 'assistant',
    label: 'Assistant',
    systemPrompt:
      'You are a patient expert learning assistant with deep, practitioner-level command of Google Ads and digital marketing (campaign types, the auction and Ad Rank, Quality Score, match types and negatives, Smart Bidding, conversion tracking, account structure and optimisation). Explain concepts clearly and accurately, build on what the learner already knows, give concrete examples and settings, and offer practical next steps. Ground your answer in any platform knowledge provided below. Be encouraging and concrete.',
    retrievalScope: 'shared',
    tools: ['learningPath', 'summarize'],
    tier: 'fast',
  },
  sandbox: {
    id: 'sandbox',
    label: 'Sandbox mentor',
    systemPrompt:
      'You are a hands-on mentor helping the user build and experiment inside the Sandbox. Be practical, guide step-by-step, and suggest what to try next.',
    retrievalScope: 'sandbox',
    tools: ['summarize', 'learningPath'],
    tier: 'fast',
  },
}

export interface RunAgentOptions {
  /** Extra, surface-specific context appended to the system prompt. */
  extraContext?: string
  /** Privacy guardrail forwarded to the unified provider. */
  allowedProviders?: ProviderName[]
  /** Force a specific model id (e.g. user picked one in the UI). */
  overrideModelId?: string
  /** Override the agent's default tier. */
  tier?: ModelTier
  /** Skip corpus retrieval (e.g. for pure creative generation). */
  skipRetrieval?: boolean
}

export interface AgentRunResult extends AskResult {
  agent: AgentId
  /** Corpus entry ids that were retrieved and injected, for transparency. */
  retrievedIds: string[]
}

/**
 * Run a named agent against the unified AI service.
 *
 * Assembles the system prompt from: the agent persona + retrieved corpus
 * knowledge (same corpus for every surface) + any surface-specific context,
 * then delegates to the single `ask()` provider with failover.
 */
export async function runAgent(
  agentId: AgentId,
  userInput: string,
  options: RunAgentOptions = {},
): Promise<AgentRunResult> {
  const agent = AGENTS[agentId]
  if (!agent) throw new Error(`Unknown agent "${agentId}".`)

  const snippets = options.skipRetrieval
    ? []
    : retrieve(agent.retrievalScope, userInput)

  const contextParts = [agent.systemPrompt]
  const retrievalBlock = formatRetrieval(snippets)
  if (retrievalBlock) contextParts.push(retrievalBlock)
  if (options.extraContext) contextParts.push(options.extraContext)

  const result = await ask(userInput, {
    context: contextParts.join('\n\n'),
    tier: options.tier ?? agent.tier,
    allowedProviders: options.allowedProviders,
    overrideModelId: options.overrideModelId,
  })

  return {
    ...result,
    agent: agentId,
    retrievedIds: snippets.map((s) => s.id),
  }
}

/** Get the tools available to a given agent, in registry order. */
export function toolsForAgent(agentId: AgentId): AgentTool[] {
  const agent = AGENTS[agentId]
  if (!agent) return []
  return agent.tools.map((id) => TOOLS[id])
}
