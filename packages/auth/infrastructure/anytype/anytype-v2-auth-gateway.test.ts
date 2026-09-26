import { describe, expect, test } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from '@anytype-calendar/anytype-client/infrastructure'
import { AnytypeV2AuthGateway } from './anytype-v2-auth-gateway'

type FetchCall = { url: string; init: Parameters<AnytypeFetch>[1] }

function setup(status: number, body: unknown) {
  const calls: FetchCall[] = []
  const client = new AnytypeClient({
    fetch: async (url, init) => {
      calls.push({ url, init })
      return { status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }
    }
  })
  return { gateway: new AnytypeV2AuthGateway(client), calls }
}

const authFailure = {
  object: 'error',
  status: 500,
  code: 'internal_server_error',
  message: 'failed to authenticate user'
}

describe('createChallenge', () => {
  test('asks Anytype for a v2 challenge under the app name and resolves its id', async () => {
    const { gateway, calls } = setup(201, { challenge_id: 'ch_1' })

    await expect(gateway.createChallenge('Calendar')).resolves.toBe('ch_1')
    expect(calls[0]?.url).toBe('http://127.0.0.1:31009/v2/auth/challenges')
    expect(calls[0]?.init).toMatchObject({ method: 'POST', body: '{"app_name":"Calendar"}' })
    expect(calls[0]?.init.headers).not.toHaveProperty('Authorization')
  })

  test('resolves null when Anytype has no v2 route', async () => {
    const { gateway } = setup(404, '404 page not found')
    await expect(gateway.createChallenge('Calendar')).resolves.toBeNull()
  })

  test('resolves null when Anytype asks a key of a route that needs none', async () => {
    const { gateway } = setup(401, { object: 'error', status: 401, code: 'unauthorized', message: 'x' })
    await expect(gateway.createChallenge('Calendar')).resolves.toBeNull()
  })

  test('rejects on an error status', async () => {
    const { gateway } = setup(500, { ...authFailure, message: 'failed to create a new challenge' })
    await expect(gateway.createChallenge('Calendar')).rejects.toThrow('500')
  })
})

describe('exchangeCode', () => {
  test('exchanges the challenge and code for the key', async () => {
    const { gateway, calls } = setup(201, {
      api_key: 'anytype_key',
      grant: { all_spaces: true, space_ids: [], permission: 'read' }
    })

    await expect(gateway.exchangeCode('ch_1', '2749')).resolves.toEqual({ ok: true, apiKey: 'anytype_key' })
    expect(calls[0]?.url).toBe('http://127.0.0.1:31009/v2/auth/api_keys')
    expect(calls[0]?.init.body).toBe('{"challenge_id":"ch_1","code":"2749"}')
  })

  test.each([400, 500])('resolves a %i as a rejected code', async (status) => {
    const { gateway } = setup(status, { ...authFailure, status })
    await expect(gateway.exchangeCode('ch_1', '0000')).resolves.toEqual({ ok: false, failure: 'invalid-code' })
  })

  test('rejects on any other error status, without echoing the body', async () => {
    const { gateway } = setup(403, { message: 'anytype_secret' })
    const exchange = gateway.exchangeCode('ch_1', '2749')
    await expect(exchange).rejects.toThrow('403')
    await expect(exchange).rejects.not.toThrow('anytype_secret')
  })
})
