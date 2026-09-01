/**
 * GET /api/integrations/status
 * Reports whether Google integration is configured on this environment and
 * whether the current user has connected it.
 */

import { googleConfigured, isConnected } from '../_lib/googleTokens.js'

export default function handler(req, res) {
  return res.status(200).json({
    google: { configured: googleConfigured(), connected: isConnected(req) },
  })
}
