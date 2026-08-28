import { describe, it, expect } from 'vitest'
import { mediaPermissionNotice } from './media'

describe('mediaPermissionNotice', () => {
  it('returns null when both are granted', () => {
    expect(mediaPermissionNotice('granted', 'granted')).toBeNull()
  })

  it('returns null when the state is unknown (Permissions API unsupported)', () => {
    expect(mediaPermissionNotice(undefined, undefined)).toBeNull()
    expect(mediaPermissionNotice('prompt', 'prompt')).toBeNull()
  })

  it('flags a blocked camera but keeps the session usable', () => {
    const msg = mediaPermissionNotice('denied', 'granted')
    expect(msg).toMatch(/camera is blocked/i)
    expect(msg).toMatch(/chat/i)
  })

  it('flags a blocked microphone', () => {
    expect(mediaPermissionNotice('granted', 'denied')).toMatch(/microphone is blocked/i)
  })

  it('flags both when both are denied', () => {
    expect(mediaPermissionNotice('denied', 'denied')).toMatch(/camera and microphone/i)
  })
})
