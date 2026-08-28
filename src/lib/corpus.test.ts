import { describe, it, expect } from 'vitest'
import { retrieve, formatRetrieval, CORPUS } from './corpus'

describe('corpus retrieval (LLP-20)', () => {
  it('returns relevant snippets for a query', () => {
    const results = retrieve('shared', 'how does the AI provider failover work')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeGreaterThan(0)
    // The AI-layer entry should surface for a provider/failover question.
    expect(results.some((r) => r.id === 'ai-layer')).toBe(true)
  })

  it('ranks by descending score', () => {
    const results = retrieve('shared', 'privacy passwordless sign-in session')
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })

  it('returns nothing for an empty query', () => {
    expect(retrieve('shared', '   ')).toEqual([])
  })

  it('sandbox scope also sees shared entries (same corpus)', () => {
    const shared = retrieve('shared', 'platform sandbox blocks workflow', 10)
    const sandbox = retrieve('sandbox', 'platform sandbox blocks workflow', 10)
    // Sandbox sees at least everything shared sees for the same query.
    expect(sandbox.length).toBeGreaterThanOrEqual(shared.length)
  })

  it('respects the limit', () => {
    expect(retrieve('sandbox', 'sandbox platform ai session tools', 2).length).toBeLessThanOrEqual(2)
  })

  it('formatRetrieval renders a labelled block, empty for no snippets', () => {
    expect(formatRetrieval([])).toBe('')
    const block = formatRetrieval(retrieve('shared', 'sessions token budget'))
    expect(block).toContain('Relevant platform knowledge')
  })

  it('every corpus entry is tagged with at least one scope', () => {
    expect(CORPUS.every((e) => e.scopes.length > 0)).toBe(true)
  })
})
