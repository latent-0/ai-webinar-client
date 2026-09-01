import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'node:crypto'
import { jaasConfigured, signJaasJwt } from './jaas.js'

// Generate a throwaway RSA keypair and configure JaaS from it, so we can verify
// the produced JWT end-to-end without any real credentials.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' })

beforeAll(() => {
  process.env.JAAS_APP_ID = 'vpaas-magic-cookie-test'
  process.env.JAAS_KID = 'vpaas-magic-cookie-test/deadbeef'
  process.env.JAAS_PRIVATE_KEY = PEM
})

function decode(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString())
}

describe('jaas token', () => {
  it('reports configured when all env vars are present', () => {
    expect(jaasConfigured()).toBe(true)
  })

  it('produces a verifiable RS256 JWT with the expected claims', () => {
    const jwt = signJaasJwt({ room: 'my-room', user: { id: 'a@b.com', name: 'Ada', email: 'a@b.com' }, moderator: true })
    const [h, p, s] = jwt.split('.')
    expect(h && p && s).toBeTruthy()

    // Signature verifies against the public key.
    const ok = crypto.createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(s, 'base64url'))
    expect(ok).toBe(true)

    const header = decode(h)
    expect(header.alg).toBe('RS256')
    expect(header.kid).toBe('vpaas-magic-cookie-test/deadbeef')

    const payload = decode(p)
    expect(payload.aud).toBe('jitsi')
    expect(payload.iss).toBe('chat')
    expect(payload.sub).toBe('vpaas-magic-cookie-test')
    expect(payload.room).toBe('my-room')
    expect(payload.exp).toBeGreaterThan(payload.iat)
    expect(payload.context.user.name).toBe('Ada')
    expect(payload.context.user.moderator).toBe('true')
  })

  it('falls back (unconfigured) when env is missing', () => {
    const saved = process.env.JAAS_APP_ID
    delete process.env.JAAS_APP_ID
    expect(jaasConfigured()).toBe(false)
    process.env.JAAS_APP_ID = saved
  })
})
