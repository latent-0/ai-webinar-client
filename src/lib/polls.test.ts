import { describe, it, expect } from 'vitest'
import { computeTally, isHost, canVote, validatePollInput, toPollView, type Poll } from './polls'

const OPTIONS = [
  { id: 'a', label: 'Yes' },
  { id: 'b', label: 'No' },
  { id: 'c', label: 'Maybe' },
]

const poll: Poll = {
  id: 'p1', roomId: 'r1', question: 'Ship it?', options: OPTIONS,
  status: 'open', createdBy: 'host@napkin.ie', createdAt: '2026-01-01T00:00:00Z',
}

describe('computeTally', () => {
  it('counts votes per option and totals them', () => {
    const t = computeTally(OPTIONS, { 'u1@x': 'a', 'u2@x': 'a', 'u3@x': 'b' })
    expect(t.total).toBe(3)
    expect(t.entries).toEqual([
      { optionId: 'a', count: 2 },
      { optionId: 'b', count: 1 },
      { optionId: 'c', count: 0 },
    ])
  })

  it('ignores votes for unknown options', () => {
    const t = computeTally(OPTIONS, { 'u1@x': 'zzz' })
    expect(t.total).toBe(0)
  })
})

describe('isHost', () => {
  it('matches the creator case-insensitively', () => {
    expect(isHost(poll, 'HOST@napkin.ie')).toBe(true)
    expect(isHost(poll, 'someone@else.com')).toBe(false)
    expect(isHost(poll, null)).toBe(false)
  })
})

describe('canVote', () => {
  it('allows a first vote while open', () => {
    expect(canVote(poll, {}, 'new@x')).toBe(true)
  })
  it('rejects a second vote from the same voter (vote once)', () => {
    expect(canVote(poll, { 'new@x': 'a' }, 'NEW@x')).toBe(false)
  })
  it('rejects voting once revealed or closed', () => {
    expect(canVote({ status: 'revealed' }, {}, 'new@x')).toBe(false)
    expect(canVote({ status: 'closed' }, {}, 'new@x')).toBe(false)
  })
  it('rejects an anonymous voter', () => {
    expect(canVote(poll, {}, null)).toBe(false)
  })
})

describe('validatePollInput', () => {
  it('requires a question and >=2 options', () => {
    expect(validatePollInput('', ['a', 'b'])).toMatch(/question/i)
    expect(validatePollInput('Q?', ['only one'])).toMatch(/two/i)
    expect(validatePollInput('Q?', ['a', 'b'])).toBeNull()
  })
})

describe('toPollView — host-controlled reveal', () => {
  const votes = { 'u1@x': 'a', 'u2@x': 'b' }

  it('hides per-option counts from a participant until revealed', () => {
    const v = toPollView(poll, votes, 'u1@x')
    expect(v.isHost).toBe(false)
    expect(v.results).toBeNull()
    expect(v.total).toBe(2) // aggregate total is safe to show
    expect(v.youVoted).toBe(true)
  })

  it('shows the live tally to the host even while open', () => {
    const v = toPollView(poll, votes, 'host@napkin.ie')
    expect(v.isHost).toBe(true)
    expect(v.results).not.toBeNull()
  })

  it('shows results to participants once revealed', () => {
    const v = toPollView({ ...poll, status: 'revealed' }, votes, 'u1@x')
    expect(v.results).not.toBeNull()
  })
})
