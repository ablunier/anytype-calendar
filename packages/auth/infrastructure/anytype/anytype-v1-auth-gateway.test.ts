import { describe, expect, test } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from '@anytype-calendar/anytype-client/infrastructure'
import { AnytypeV1AuthGateway } from './anytype-v1-auth-gateway'

type FetchCall = { url: string; init: Parameters<AnytypeFetch>[1] }

function setup(status: number, body: unknown) {
  const calls: FetchCall[] = []
  const client = new AnytypeClient({
    fetch: async (url, init) => {
      calls.push({ url, init })
      return { status, text: async () => JSON.stringify(body) }
    }
  })
  return { gateway: new AnytypeV1AuthGateway(client), calls }
}

const authFailure = {
  object: 'error',
  status: 500,
  code: 'internal_server_error',
  message: 'failed to authenticate user'
}

describe('createChallenge', () => {
  test('asks Anytype for a challenge under the app name and resolves its id', async () => {
    const { gateway, calls } = setup(201, { challenge_id: 'ch_1' })

    await expect(gateway.createChallenge('Calendar')).resolves.toBe('ch_1')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('http://127.0.0.1:31009/v1/auth/challenges')
    expect(calls[0]?.init).toMatchObject({ method: 'POST', body: '{"app_name":"Calendar"}' })
    expect(calls[0]?.init.headers).not.toHaveProperty('Authorization')
  })

  test('rejects on an error status', async () => {
    const { gateway } = setup(500, { ...authFailure, message: 'failed to create a new challenge' })
    await expect(gateway.createChallenge('Calendar')).rejects.toThrow('500')
  })

  test('rejects when the body carries no challenge id', async () => {
    const { gateway } = setup(201, { challenge: 'ch_1' })
    await expect(gateway.createChallenge('Calendar')).rejects.toThrow('challenge')
  })

  test('rejects when Anytype cannot be reached', async () => {
    const gateway = new AnytypeV1AuthGateway(
      new AnytypeClient({
        fetch: async () => {
          throw new TypeError('fetch failed')
        }
      })
    )
    await expect(gateway.createChallenge('Calendar')).rejects.toThrow('fetch failed')
  })
})

describe('exchangeCode', () => {
  test('sends the challenge and code, and resolves the key', async () => {
    const { gateway, calls } = setup(201, { api_key: 'ak_secret' })

    await expect(gateway.exchangeCode('ch_1', '2749')).resolves.toEqual({
      ok: true,
      apiKey: 'ak_secret'
    })
    expect(calls[0]?.url).toBe('http://127.0.0.1:31009/v1/auth/api_keys')
    expect(calls[0]?.init).toMatchObject({
      method: 'POST',
      body: '{"challenge_id":"ch_1","code":"2749"}'
    })
  })

  test('reads the 500 Anytype sends for a wrong, expired or unknown code as a rejected code', async () => {
    const { gateway } = setup(500, authFailure)
    await expect(gateway.exchangeCode('ch_1', '1111')).resolves.toEqual({
      ok: false,
      failure: 'invalid-code'
    })
  })

  test('reads a 400 as a rejected code', async () => {
    const { gateway } = setup(400, { ...authFailure, status: 400, code: 'bad_request' })
    await expect(gateway.exchangeCode('ch_1', '1111')).resolves.toEqual({
      ok: false,
      failure: 'invalid-code'
    })
  })

  test('rejects on any other error status', async () => {
    const { gateway } = setup(429, { object: 'error', status: 429, code: 'rate_limit_exceeded' })
    await expect(gateway.exchangeCode('ch_1', '2749')).rejects.toThrow('429')
  })

  test('rejects when the body carries no key, without echoing the body', async () => {
    const { gateway } = setup(201, { apiKey: 'ak_secret' })

    const exchanging = gateway.exchangeCode('ch_1', '2749')
    await expect(exchanging).rejects.toThrow('API key')
    await expect(exchanging).rejects.not.toThrow('ak_secret')
  })
})

describe('verifyApiKey', () => {
  test('sends the key as a bearer token and resolves ok on success', async () => {
    const { gateway, calls } = setup(200, { data: [] })

    await expect(gateway.verifyApiKey('ak_secret')).resolves.toEqual({ ok: true })
    expect(calls[0]?.url).toBe('http://127.0.0.1:31009/v1/spaces')
    expect(calls[0]?.init).toMatchObject({ method: 'GET' })
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: 'Bearer ak_secret' })
  })

  test('reads a 401 as a key Anytype does not recognise', async () => {
    const { gateway } = setup(401, { ...authFailure, status: 401, code: 'unauthorized' })
    await expect(gateway.verifyApiKey('ak_wrong')).resolves.toEqual({
      ok: false,
      failure: 'invalid-key'
    })
  })

  test('rejects on any other error status', async () => {
    const { gateway } = setup(500, authFailure)
    await expect(gateway.verifyApiKey('ak_secret')).rejects.toThrow('500')
  })

  test('rejects when Anytype cannot be reached', async () => {
    const gateway = new AnytypeV1AuthGateway(
      new AnytypeClient({
        fetch: async () => {
          throw new TypeError('fetch failed')
        }
      })
    )
    await expect(gateway.verifyApiKey('ak_secret')).rejects.toThrow('fetch failed')
  })
})
