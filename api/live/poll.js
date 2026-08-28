/**
 * /api/live/poll  (LLP-74 / T-68)
 *
 * Server-authoritative poll operations. The browser never writes poll data
 * directly — it calls this endpoint, which uses the Supabase service role.
 *   - "vote once" is enforced by the poll_votes primary key (poll_id, voter)
 *   - host-only reveal/close is enforced by comparing the session email to the
 *     poll's created_by
 *   - the live per-option tally is returned only to the host; participants get
 *     it only after the host reveals (mirrors src/lib/polls.ts, the canonical
 *     + unit-tested version of this logic)
 *
 * GET  ?roomId=…                      → { poll: PollView | null }
 * POST { action: 'launch', roomId, question, options }
 * POST { action: 'vote',   pollId, optionId }
 * POST { action: 'reveal' | 'close', pollId }
 */

import { getSession } from '../_lib/auth.js'
import { getServiceClient, supabaseConfigured } from '../_lib/supabase.js'
import { readJson } from '../_lib/ai.js'

function tally(options, voteRows) {
  const counts = new Map(options.map((o) => [o.id, 0]))
  let total = 0
  for (const row of voteRows) {
    if (counts.has(row.option_id)) {
      counts.set(row.option_id, counts.get(row.option_id) + 1)
      total++
    }
  }
  return { entries: options.map((o) => ({ optionId: o.id, count: counts.get(o.id) })), total }
}

function validate(question, options) {
  if (typeof question !== 'string' || !question.trim()) return 'A question is required.'
  if (!Array.isArray(options)) return 'Options must be a list.'
  const labels = options.map((o) => String(typeof o === 'string' ? o : o?.label ?? '').trim()).filter(Boolean)
  if (labels.length < 2) return 'Provide at least two options.'
  if (labels.length > 10) return 'A poll can have at most ten options.'
  return null
}

const isHost = (poll, email) => !!email && email.toLowerCase() === String(poll.created_by).toLowerCase()

async function loadVotes(db, pollId) {
  const { data, error } = await db.from('poll_votes').select('voter, option_id').eq('poll_id', pollId)
  if (error) throw new Error(error.message)
  return data || []
}

/** Shape a poll row into the view a given viewer is allowed to see. */
function toView(poll, voteRows, email) {
  const host = isHost(poll, email)
  const revealed = poll.status === 'revealed'
  const t = tally(poll.options, voteRows)
  return {
    id: poll.id,
    roomId: poll.room_id,
    question: poll.question,
    options: poll.options,
    status: poll.status,
    isHost: host,
    youVoted: !!email && voteRows.some((v) => String(v.voter).toLowerCase() === email.toLowerCase()),
    total: host || revealed ? t.total : undefined,
    results: host || revealed ? t.entries : null,
  }
}

export default async function handler(req, res) {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'Not authenticated.' })
  if (!supabaseConfigured()) {
    return res.status(503).json({ error: 'Realtime polls are not configured (Supabase env vars missing).' })
  }
  const db = getServiceClient()
  const email = session.email

  try {
    if (req.method === 'GET') {
      const roomId = req.query?.roomId
      if (!roomId) return res.status(400).json({ error: 'roomId is required.' })
      const poll = await activePoll(db, roomId)
      if (!poll) return res.status(200).json({ poll: null })
      const votes = await loadVotes(db, poll.id)
      return res.status(200).json({ poll: toView(poll, votes, email) })
    }

    if (req.method === 'POST') {
      const body = await readJson(req)
      const action = body.action

      if (action === 'launch') {
        const err = validate(body.question, body.options)
        if (err) return res.status(400).json({ error: err })
        if (await activePoll(db, body.roomId)) {
          return res.status(409).json({ error: 'A poll is already active in this room.' })
        }
        const options = body.options.map((o, i) => ({
          id: (typeof o === 'object' && o?.id) || `o${i + 1}`,
          label: String(typeof o === 'string' ? o : o.label).trim(),
        }))
        const { data, error } = await db
          .from('polls')
          .insert({ room_id: body.roomId, question: body.question.trim(), options, created_by: email, status: 'open' })
          .select()
          .single()
        if (error) return res.status(502).json({ error: error.message })
        return res.status(200).json({ poll: toView(data, [], email) })
      }

      if (action === 'vote') {
        const poll = await pollById(db, body.pollId)
        if (!poll) return res.status(404).json({ error: 'Poll not found.' })
        if (poll.status !== 'open') return res.status(409).json({ error: 'Voting is closed for this poll.' })
        if (!poll.options.some((o) => o.id === body.optionId)) {
          return res.status(400).json({ error: 'Unknown option.' })
        }
        const { error } = await db.from('poll_votes').insert({ poll_id: poll.id, voter: email, option_id: body.optionId })
        if (error) {
          if (error.code === '23505') return res.status(409).json({ error: 'You have already voted.' })
          return res.status(502).json({ error: error.message })
        }
        return res.status(200).json({ ok: true })
      }

      if (action === 'reveal' || action === 'close') {
        const poll = await pollById(db, body.pollId)
        if (!poll) return res.status(404).json({ error: 'Poll not found.' })
        if (!isHost(poll, email)) return res.status(403).json({ error: 'Only the host can do that.' })
        const patch =
          action === 'reveal'
            ? { status: 'revealed', revealed_at: new Date().toISOString(), results: tally(poll.options, await loadVotes(db, poll.id)).entries }
            : { status: 'closed' }
        const { data, error } = await db.from('polls').update(patch).eq('id', poll.id).select().single()
        if (error) return res.status(502).json({ error: error.message })
        const votes = await loadVotes(db, poll.id)
        return res.status(200).json({ poll: toView(data, votes, email) })
      }

      return res.status(400).json({ error: `Unknown action "${action}".` })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : String(e) })
  }
}

async function activePoll(db, roomId) {
  const { data, error } = await db
    .from('polls')
    .select('*')
    .eq('room_id', roomId)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] || null
}

async function pollById(db, id) {
  if (!id) return null
  const { data, error } = await db.from('polls').select('*').eq('id', id).single()
  if (error) return null
  return data
}
