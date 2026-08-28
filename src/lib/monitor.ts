/**
 * Monitor logic (LLP-82 / T-76)
 *
 * Pure helpers that turn per-room presence heartbeats into an at-a-glance
 * count and activity level for the facilitator's monitor grid. Unit-tested so
 * the "who's in it / how active" signal is verifiable without a live room.
 */

export interface Presence {
  identity: string
  lastSeen: number // epoch ms of the last heartbeat
}

export type ActivityLevel = 'idle' | 'quiet' | 'active'

/** Someone counts as "present" if seen within this window. */
export const PRESENT_WINDOW_MS = 20_000
/** A heartbeat this recent counts as "actively doing something". */
export const ACTIVE_WINDOW_MS = 8_000

export function presentPeople(presences: Presence[], now: number, windowMs = PRESENT_WINDOW_MS): Presence[] {
  return presences.filter((p) => now - p.lastSeen <= windowMs)
}

/** idle (nobody present) · quiet (present but few recent) · active (most recent). */
export function activityLevel(presences: Presence[], now: number): ActivityLevel {
  const present = presentPeople(presences, now)
  if (present.length === 0) return 'idle'
  const active = present.filter((p) => now - p.lastSeen <= ACTIVE_WINDOW_MS).length
  return active >= Math.ceil(present.length / 2) ? 'active' : 'quiet'
}

export interface RoomStatus { count: number; level: ActivityLevel }

export function roomStatus(presences: Presence[], now: number): RoomStatus {
  return { count: presentPeople(presences, now).length, level: activityLevel(presences, now) }
}
