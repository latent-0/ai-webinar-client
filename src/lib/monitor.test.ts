import { describe, it, expect } from 'vitest'
import { presentPeople, activityLevel, roomStatus } from './monitor'

const NOW = 1_000_000

describe('presentPeople', () => {
  it('keeps recent heartbeats and drops stale ones', () => {
    const p = [
      { identity: 'a', lastSeen: NOW - 1_000 },
      { identity: 'b', lastSeen: NOW - 19_000 },
      { identity: 'c', lastSeen: NOW - 25_000 }, // stale
    ]
    expect(presentPeople(p, NOW).map((x) => x.identity)).toEqual(['a', 'b'])
  })
})

describe('activityLevel', () => {
  it('is idle when nobody is present', () => {
    expect(activityLevel([{ identity: 'a', lastSeen: NOW - 60_000 }], NOW)).toBe('idle')
  })
  it('is active when most present people are recently active', () => {
    const p = [
      { identity: 'a', lastSeen: NOW - 1_000 },
      { identity: 'b', lastSeen: NOW - 2_000 },
      { identity: 'c', lastSeen: NOW - 15_000 },
    ]
    expect(activityLevel(p, NOW)).toBe('active')
  })
  it('is quiet when present but mostly inactive', () => {
    const p = [
      { identity: 'a', lastSeen: NOW - 15_000 },
      { identity: 'b', lastSeen: NOW - 16_000 },
      { identity: 'c', lastSeen: NOW - 2_000 },
    ]
    expect(activityLevel(p, NOW)).toBe('quiet')
  })
})

describe('roomStatus', () => {
  it('reports present count and level together', () => {
    const p = [
      { identity: 'a', lastSeen: NOW - 1_000 },
      { identity: 'b', lastSeen: NOW - 30_000 },
    ]
    expect(roomStatus(p, NOW)).toEqual({ count: 1, level: 'active' })
  })
})
