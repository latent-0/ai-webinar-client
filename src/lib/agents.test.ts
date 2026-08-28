import { describe, it, expect } from 'vitest'
import { AGENTS, TOOLS, toolsForAgent, type AgentId } from './agents'

describe('agent core registry (LLP-20)', () => {
  it('defines the three surfaces', () => {
    const ids: AgentId[] = ['live', 'assistant', 'sandbox']
    for (const id of ids) expect(AGENTS[id]).toBeDefined()
  })

  it('each agent has a prompt, scope, tools and tier', () => {
    for (const agent of Object.values(AGENTS)) {
      expect(agent.systemPrompt.length).toBeGreaterThan(0)
      expect(['shared', 'sandbox']).toContain(agent.retrievalScope)
      expect(Array.isArray(agent.tools)).toBe(true)
      expect(['judgement', 'fast']).toContain(agent.tier)
    }
  })

  it('Live and Assistant share the same corpus scope (LLP-20 acceptance)', () => {
    expect(AGENTS.live.retrievalScope).toBe(AGENTS.assistant.retrievalScope)
  })

  it('exposes the pluggable tool set', () => {
    for (const id of ['summarize', 'learningPath', 'transcript'] as const) {
      expect(TOOLS[id]).toBeDefined()
      expect(typeof TOOLS[id].run).toBe('function')
    }
  })

  it('toolsForAgent resolves an agent tools to real tool objects', () => {
    const tools = toolsForAgent('assistant')
    expect(tools.length).toBe(AGENTS.assistant.tools.length)
    expect(tools.every((t) => typeof t.run === 'function')).toBe(true)
  })
})
