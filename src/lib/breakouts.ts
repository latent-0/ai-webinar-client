/**
 * Breakout logic (LLP-80 / T-74)
 *
 * Pure helpers for splitting participants into rooms and finding one's own
 * room. Transport-agnostic and unit-tested so the "distributed evenly" rule is
 * verifiable without a database.
 */

export interface BreakoutRoom {
  index: number
  name: string
  roomId: string // the Jitsi/session room id participants navigate to
  members: string[] // participant identities (display names)
}

export interface BreakoutSession {
  id: string
  parentRoomId: string
  status: 'open' | 'closed'
  rooms: BreakoutRoom[]
  timerEndsAt: string | null
  createdBy: string
}

/** Deterministic child room id for a breakout, derived from its parent. */
export function breakoutRoomId(parentRoomId: string, index: number): string {
  return `${parentRoomId}--b${index}`
}

/**
 * Split items across `roomCount` rooms as evenly as possible (round-robin), so
 * 18 people over 4 rooms become 5/5/4/4 rather than 5/5/5/3.
 */
export function splitEvenly<T>(items: T[], roomCount: number): T[][] {
  const n = Math.max(1, Math.floor(roomCount))
  const buckets: T[][] = Array.from({ length: n }, () => [])
  items.forEach((item, i) => buckets[i % n].push(item))
  return buckets
}

/** Build breakout rooms by auto-splitting members evenly. */
export function buildRooms(
  parentRoomId: string,
  members: string[],
  roomCount: number,
  names?: string[],
): BreakoutRoom[] {
  return splitEvenly(members, roomCount).map((mem, i) => ({
    index: i + 1,
    name: names?.[i]?.trim() || `Room ${i + 1}`,
    roomId: breakoutRoomId(parentRoomId, i + 1),
    members: mem,
  }))
}

/** Find the room a given participant (by display name) is assigned to. */
export function findMyRoom(rooms: BreakoutRoom[], identity: string | null | undefined): BreakoutRoom | null {
  if (!identity) return null
  const id = identity.toLowerCase()
  return rooms.find((r) => r.members.some((m) => m.toLowerCase() === id)) || null
}

/** Milliseconds left on an optional timer, or null if there is none. */
export function timerRemainingMs(endsAt: string | null, now: number): number | null {
  if (!endsAt) return null
  return Math.max(0, new Date(endsAt).getTime() - now)
}

/** Format a millisecond duration as m:ss. */
export function formatCountdown(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
