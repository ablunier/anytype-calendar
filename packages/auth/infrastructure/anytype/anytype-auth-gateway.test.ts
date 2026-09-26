import { describe, expect, test } from 'vitest'
import {
  AnytypeClient,
  AnytypeDialectProbe,
  type AnytypeFetch
} from '@anytype-calendar/anytype-client/infrastructure'
import { AnytypeAuthGateway } from './anytype-auth-gateway'
import { AnytypeV1AuthGateway } from './anytype-v1-auth-gateway'
import { AnytypeV2AuthGateway } from './anytype-v2-auth-gateway'

type Reply = { status: number; text: string }

const NO_ROUTE: Reply = { status: 404, text: '404 page not found' }
const json = (status: number, body: unknown): Reply => ({ status, text: JSON.stringify(body) })
const REFUSED = json(401, { object: 'error', status: 401, code: 'unauthorized', message: 'x' })

/** Replies by method and path; a list of replies is served in turn. */
function setup(routes: Record<string, Reply | Reply[]>) {
  const calls: string[] = []
  const served: Record<string, number> = {}
  const fetch: AnytypeFetch = async (url, init) => {
    const route = `${init.method} ${url.replace('http://127.0.0.1:31009', '').split('?')[0]}`
    calls.push(route)
    const replies = routes[route]
    if (!replies) return { status: NO_ROUTE.status, text: async () => NO_ROUTE.text }
    const list = Array.isArray(replies) ? replies : [replies]
    const n = (served[route] = (served[route] ?? 0) + 1)
    const reply = list[Math.min(n, list.length) - 1] as Reply
    return { status: reply.status, text: async () => reply.text }
  }
  const client = new AnytypeClient({ fetch })
  const probe = new AnytypeDialectProbe({ client })
  const gateway = new AnytypeAuthGateway({
    probe,
    v1: new AnytypeV1AuthGateway(client),
    v2: new AnytypeV2AuthGateway(client)
  })
  return { gateway, calls }
}

describe('pairing', () => {
  test('pairs through v2 where Anytype serves it', async () => {
    const { gateway, calls } = setup({
      'POST /v2/auth/challenges': json(201, { challenge_id: 'ch_2' }),
      'POST /v2/auth/api_keys': json(201, { api_key: 'anytype_key', grant: null })
    })

    await expect(gateway.createChallenge('Calendar')).resolves.toBe('ch_2')
    await expect(gateway.exchangeCode('ch_2', '2749')).resolves.toEqual({ ok: true, apiKey: 'anytype_key' })
    expect(calls).toEqual(['POST /v2/auth/challenges', 'POST /v2/auth/api_keys'])
  })

  test('falls back to v1, and exchanges the code where the challenge came from', async () => {
    const { gateway, calls } = setup({
      'POST /v1/auth/challenges': json(201, { challenge_id: 'ch_1' }),
      'POST /v1/auth/api_keys': [
        json(500, { object: 'error', code: 'internal_server_error', message: 'x' }),
        json(201, { api_key: 'ak_key' })
      ]
    })

    await expect(gateway.createChallenge('Calendar')).resolves.toBe('ch_1')
    await expect(gateway.exchangeCode('ch_1', '0000')).resolves.toEqual({ ok: false, failure: 'invalid-code' })
    await expect(gateway.exchangeCode('ch_1', '2749')).resolves.toEqual({ ok: true, apiKey: 'ak_key' })
    expect(calls).toEqual([
      'POST /v2/auth/challenges',
      'POST /v1/auth/challenges',
      'POST /v1/auth/api_keys',
      'POST /v1/auth/api_keys'
    ])
  })
})

describe('verifyApiKey', () => {
  test('accepts a key v2 answers whoami for, without asking again', async () => {
    const { gateway, calls } = setup({ 'GET /v2/auth/whoami': json(200, { grant: {} }) })

    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({ ok: true })
    expect(calls).toEqual(['GET /v2/auth/whoami'])
  })

  test('refuses a key whoami refuses', async () => {
    const { gateway } = setup({ 'GET /v2/auth/whoami': REFUSED })
    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({ ok: false, failure: 'invalid-key' })
  })

  test('checks the key through v1 where Anytype has no v2', async () => {
    const { gateway, calls } = setup({ 'GET /v1/spaces': REFUSED })

    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({ ok: false, failure: 'invalid-key' })
    expect(calls).toEqual(['GET /v2/auth/whoami', 'GET /v1/spaces'])
  })
})
