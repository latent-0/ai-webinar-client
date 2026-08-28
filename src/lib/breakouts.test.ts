import { describe, it, expect } from 'vitest'
import { splitEvenly, buildRooms, findMyRoom, breakoutRoomId, timerRemainingMs, formatCountdown } from './breakouts'

describe('splitEvenly', () => {
  it('distributes 18 across 4 rooms as evenly as possible', () => {
    const people = Array.from({ length: 18 }, (_, i) => `p${i + 1}`)
    const groups = splitEvenly(people, 4)
    expect(groups.map((g) => g.length)).toEqual([5, 5, 4, 4])
    expect(groups.flat().sort()).toEqual(people.sort()) // nobody lost or duplicated
  })

  it('handles fewer people than rooms', () => {
    expect(splitEvenly(['a', 'b'], 4).map((g) => g.length)).toEqual([1, 1, 0, 0])
  })

  it('coerces a bad room count to at least one bucket', () => {
    expect(splitEvenly(['a', 'b'], 0)).toEqual([['a', 'b']])
  })
})

describe('buildRooms', () => {
  it('creates evenly-filled rooms with derived ids and default names', () => {
    const rooms = buildRooms('sess1', ['a', 'b', 'c'], 2)
    expect(rooms).toHaveLength(2)
    expect(rooms[0]).toMatchObject({ index: 1, name: 'Room 1', roomId: 'sess1--b1' })
    expect(rooms[0].members).toEqual(['a', 'c'])
    expect(rooms[1].members).toEqual(['b'])
  })

  it('respects custom names when provided', () => {
    const rooms = buildRooms('s', ['a', 'b'], 2, ['Reds', 'Blues'])
    expect(rooms.map((r) => r.name)).toEqual(['Reds', 'Blues'])
  })
})

describe('breakoutRoomId', () => {
  it('derives a stable child id from the parent', () => {
    expect(breakoutRoomId('webinar-x', 3)).toBe('webinar-x--b3')
  })
})

describe('findMyRoom', () => {
  const rooms = buildRooms('s', ['Alice', 'Bob', 'Carol'], 2)
  it('finds a participant case-insensitively', () => {
    expect(findMyRoom(rooms, 'alice')?.roomId).toBe('s--b1')
    expect(findMyRoom(rooms, 'Bob')?.roomId).toBe('s--b2')
  })
  it('returns null for an unknown or missing identity', () => {
    expect(findMyRoom(rooms, 'nobody')).toBeNull()
    expect(findMyRoom(rooms, null)).toBeNull()
  })
})

describe('timer helpers', () => {
  it('computes remaining time and never goes negative', () => {
    const now = 1_000_000
    expect(timerRemainingMs(new Date(now + 60_000).toISOString(), now)).toBe(60_000)
    expect(timerRemainingMs(new Date(now - 5_000).toISOString(), now)).toBe(0)
    expect(timerRemainingMs(null, now)).toBeNull()
  })
  it('formats as m:ss', () => {
    expect(formatCountdown(65_000)).toBe('1:05')
    expect(formatCountdown(600_000)).toBe('10:00')
  })
})
