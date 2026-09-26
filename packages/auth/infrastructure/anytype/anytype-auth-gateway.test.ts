import { describe, expect, test } from 'vitest'
import {
  AnytypeClient,
  AnytypeDialectProbe,
  type AnytypeDialect,
  type AnytypeFetch
} from '@anytype-calendar/anytype-client/infrastructure'
import { AnytypeAuthGateway } from './anytype-auth-gateway'
import { AnytypeV1AuthGateway } from './anytype-v1-auth-gateway'
import { AnytypeV2AuthGateway } from './anytype-v2-auth-gateway'

type Reply = { status: number; text: string }

const NO_ROUTE: Reply = { status: 404, text: '404 page not found' }
const json = (status: number, body: unknown): Reply => ({ status, text: JSON.stringify(body) })
const REFUSED = json(401, { object: 'error', status: 401, code: 'unauthorized', message: 'x' })

/** A key the user paired for two spaces, read-only, as `whoami?ids=full&spaces=true` describes it. */
const RESTRICTED = json(200, {
  grant: {
    scoped: true,
    restricted: true,
    all_spaces: false,
    permission: 'read',
    spaces: [
      { id: 'bafy1.repl1', name: 'Work', permission: 'read' },
      { id: 'bafy2.repl2', name: 'Home', permission: 'read' }
    ]
  },
  key_status: 'scoped'
})
/** A key issued before grants: the real Anytype answers this for one. */
const LEGACY = json(200, {
  grant: { scoped: false, restricted: false, all_spaces: false, permission: null, spaces: [] },
  key_status: 'legacy'
})
const RESTRICTED_GRANT = {
  allSpaces: false,
  spaceIds: ['bafy1.repl1', 'bafy2.repl2'],
  permission: 'read'
}

/** Replies by method and path; a list of replies is served in turn. */
function setup(routes: Record<string, Reply | Reply[]>, forced?: AnytypeDialect) {
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
  const probe = new AnytypeDialectProbe(forced ? { client, forced } : { client })
  const gateway = new AnytypeAuthGateway({
    probe,
    v1: new AnytypeV1AuthGateway(client),
    v2: new AnytypeV2AuthGateway(client)
  })
  return { gateway, calls }
}

describe('pairing', () => {
  test('pairs through v2 where Anytype serves it, and asks what the new key reaches', async () => {
    const { gateway, calls } = setup({
      'POST /v2/auth/challenges': json(201, { challenge_id: 'ch_2' }),
      'POST /v2/auth/api_keys': json(201, { api_key: 'anytype_key', grant: null }),
      'GET /v2/auth/whoami': RESTRICTED
    })

    await expect(gateway.createChallenge('Calendar')).resolves.toBe('ch_2')
    await expect(gateway.exchangeCode('ch_2', '2749')).resolves.toEqual({
      ok: true,
      apiKey: 'anytype_key',
      access: { apiVersion: 'v2', grant: RESTRICTED_GRANT }
    })
    expect(calls).toEqual(['POST /v2/auth/challenges', 'POST /v2/auth/api_keys', 'GET /v2/auth/whoami'])
  })

  test('keeps the grant pairing answered with should whoami fail', async () => {
    const { gateway } = setup({
      'POST /v2/auth/challenges': json(201, { challenge_id: 'ch_2' }),
      'POST /v2/auth/api_keys': json(201, {
        api_key: 'anytype_key',
        grant: { all_spaces: false, space_ids: ['bafy1.repl1'], permission: 'readwrite' }
      }),
      'GET /v2/auth/whoami': json(500, { status: 500, code: 'internal', message: 'x' })
    })

    await gateway.createChallenge('Calendar')
    await expect(gateway.exchangeCode('ch_2', '2749')).resolves.toMatchObject({
      access: {
        apiVersion: 'v2',
        grant: { allSpaces: false, spaceIds: ['bafy1.repl1'], permission: 'readwrite' }
      }
    })
  })

  test('reads through v1 a key paired through v2 while v1 is forced', async () => {
    const { gateway } = setup(
      {
        'POST /v2/auth/challenges': json(201, { challenge_id: 'ch_2' }),
        'POST /v2/auth/api_keys': json(201, { api_key: 'anytype_key', grant: null })
      },
      'v1'
    )

    await gateway.createChallenge('Calendar')
    await expect(gateway.exchangeCode('ch_2', '2749')).resolves.toMatchObject({
      access: { apiVersion: 'v1', grant: null }
    })
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
    await expect(gateway.exchangeCode('ch_1', '2749')).resolves.toEqual({
      ok: true,
      apiKey: 'ak_key',
      access: { apiVersion: 'v1', grant: null }
    })
    expect(calls).toEqual([
      'POST /v2/auth/challenges',
      'POST /v1/auth/challenges',
      'POST /v1/auth/api_keys',
      'POST /v1/auth/api_keys',
      'GET /v2/auth/whoami'
    ])
  })
})

describe('verifyApiKey', () => {
  test('accepts a key v2 answers whoami for, and reads its grant from that answer', async () => {
    const { gateway, calls } = setup({ 'GET /v2/auth/whoami': RESTRICTED })

    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({
      ok: true,
      access: { apiVersion: 'v2', grant: RESTRICTED_GRANT }
    })
    expect(calls).toEqual(['GET /v2/auth/whoami'])
  })

  test('reads a legacy key as having no grant', async () => {
    const { gateway } = setup({ 'GET /v2/auth/whoami': LEGACY })
    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({
      ok: true,
      access: { apiVersion: 'v2', grant: null }
    })
  })

  test('reads an all-spaces grant without its list of spaces', async () => {
    const { gateway } = setup({
      'GET /v2/auth/whoami': json(200, {
        grant: {
          scoped: true,
          restricted: false,
          all_spaces: true,
          permission: 'readwrite',
          space_count: 1,
          spaces: [{ id: 'bafy1.repl1', name: 'Work', permission: 'readwrite' }]
        }
      })
    })
    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({
      ok: true,
      access: { apiVersion: 'v2', grant: { allSpaces: true, spaceIds: [], permission: 'readwrite' } }
    })
  })

  test('asks afresh each time, since the grant may have changed in Anytype', async () => {
    const { gateway, calls } = setup({ 'GET /v2/auth/whoami': [LEGACY, RESTRICTED] })

    await expect(gateway.verifyApiKey('ak')).resolves.toMatchObject({ access: { grant: null } })
    await expect(gateway.verifyApiKey('ak')).resolves.toMatchObject({
      access: { grant: RESTRICTED_GRANT }
    })
    expect(calls).toEqual(['GET /v2/auth/whoami', 'GET /v2/auth/whoami'])
  })

  test('refuses a key whoami refuses', async () => {
    const { gateway } = setup({ 'GET /v2/auth/whoami': REFUSED })
    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({ ok: false, failure: 'invalid-key' })
  })

  test('accepts a key through v1 where Anytype has no v2, with no grant known', async () => {
    const { gateway } = setup({ 'GET /v1/spaces': json(200, { data: [] }) })
    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({
      ok: true,
      access: { apiVersion: 'v1', grant: null }
    })
  })

  test('checks the key through v1 where Anytype has no v2', async () => {
    const { gateway, calls } = setup({ 'GET /v1/spaces': REFUSED })

    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({ ok: false, failure: 'invalid-key' })
    expect(calls).toEqual(['GET /v2/auth/whoami', 'GET /v1/spaces'])
  })
})
