/**
 * Poll domain logic (LLP-74 / T-68)
 *
 * Pure, side-effect-free helpers shared by the serverless endpoints and the
 * client. Kept transport-agnostic so the vote-once / host-reveal rules can be
 * unit-tested without a database or network.
 */

export type PollStatus = 'open' | 'revealed' | 'closed'

export interface PollOption {
  id: string
  label: string
}

export interface Poll {
  id: string
  roomId: string
  question: string
  options: PollOption[]
  status: PollStatus
  createdBy: string // email of the host who launched it
  createdAt: string
  results?: TallyEntry[] | null // populated on reveal
}

export interface TallyEntry {
  optionId: string
  count: number
}

export interface Tally {
  entries: TallyEntry[]
  total: number
}

/** A participant's view of a poll — counts are hidden until the host reveals. */
export interface PollView {
  id: string
  roomId: string
  question: string
  options: PollOption[]
  status: PollStatus
  isHost: boolean
  youVoted: boolean
  total: number // number of votes cast (safe to show — it's not per-option)
  results: TallyEntry[] | null // null unless revealed OR you are the host
}

/** Tally a set of {voter -> optionId} votes across the poll's options. */
export function computeTally(options: PollOption[], votes: Record<string, string>): Tally {
  const counts = new Map<string, number>()
  for (const opt of options) counts.set(opt.id, 0)
  let total = 0
  for (const optionId of Object.values(votes)) {
    if (counts.has(optionId)) {
      counts.set(optionId, (counts.get(optionId) || 0) + 1)
      total++
    }
  }
  return { entries: options.map((o) => ({ optionId: o.id, count: counts.get(o.id) || 0 })), total }
}

/** Only the host (the email that launched the poll) may reveal or close it. */
export function isHost(poll: Pick<Poll, 'createdBy'>, email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === poll.createdBy.toLowerCase()
}

/** A voter may vote exactly once, and only while the poll is open. */
export function canVote(
  poll: Pick<Poll, 'status'>,
  votes: Record<string, string>,
  email: string | null | undefined,
): boolean {
  return !!email && poll.status === 'open' && !(email.toLowerCase() in normaliseKeys(votes))
}

/** Validate a poll definition at launch. Returns an error string, or null if OK. */
export function validatePollInput(question: unknown, options: unknown): string | null {
  if (typeof question !== 'string' || !question.trim()) return 'A question is required.'
  if (!Array.isArray(options)) return 'Options must be a list.'
  const labels = options.map((o) => (typeof o === 'string' ? o : (o?.label ?? ''))).map((s) => String(s).trim())
  const nonEmpty = labels.filter(Boolean)
  if (nonEmpty.length < 2) return 'Provide at least two options.'
  if (nonEmpty.length > 10) return 'A poll can have at most ten options.'
  return null
}

/**
 * Build the view a given viewer is allowed to see. The host always sees the
 * live tally; participants see per-option counts only once the poll is
 * revealed. This is the enforcement point for host-controlled reveal.
 */
export function toPollView(
  poll: Poll,
  votes: Record<string, string>,
  viewerEmail: string | null | undefined,
): PollView {
  const host = isHost(poll, viewerEmail)
  const tally = computeTally(poll.options, votes)
  const revealed = poll.status === 'revealed'
  return {
    id: poll.id,
    roomId: poll.roomId,
    question: poll.question,
    options: poll.options,
    status: poll.status,
    isHost: host,
    youVoted: !!viewerEmail && viewerEmail.toLowerCase() in normaliseKeys(votes),
    total: tally.total,
    results: host || revealed ? tally.entries : null,
  }
}

function normaliseKeys(votes: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of Object.keys(votes)) out[k.toLowerCase()] = votes[k]
  return out
}
