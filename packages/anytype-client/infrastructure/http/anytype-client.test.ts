import { describe, expect, test } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from './anytype-client'

type FetchCall = { url: string; init: Parameters<AnytypeFetch>[1] }

function setup(status: number, text = '') {
  const calls: FetchCall[] = []
  const fetch: AnytypeFetch = async (url, init) => {
    calls.push({ url, init })
    return { status, text: async () => text }
  }
  return { client: new AnytypeClient({ fetch }), calls }
}

describe('request', () => {
  test('sends the API version to the local API, with no body or key unless given', async () => {
    const { client, calls } = setup(200, '{"data":[]}')

    await client.request({ method: 'GET', path: '/v1/spaces' })

    expect(calls).toEqual([
      {
        url: 'http://127.0.0.1:31009/v1/spaces',
        init: { method: 'GET', headers: { 'Anytype-Version': '2025-11-08' } }
      }
    ])
  })

  test('sends a body as JSON and a key as a bearer token', async () => {
    const { client, calls } = setup(201, '{}')

    await client.request({
      method: 'POST',
      path: '/v1/spaces',
      body: { name: 'Work' },
      apiKey: 'ak_secret'
    })

    expect(calls[0]?.init).toEqual({
      method: 'POST',
      headers: {
        'Anytype-Version': '2025-11-08',
        Authorization: 'Bearer ak_secret',
        'Content-Type': 'application/json'
      },
      body: '{"name":"Work"}'
    })
  })

  test('honours a configured base URL and API version', async () => {
    const calls: FetchCall[] = []
    const client = new AnytypeClient({
      fetch: async (url, init) => {
        calls.push({ url, init })
        return { status: 200, text: async () => '' }
      },
      baseUrl: 'http://127.0.0.1:31012',
      apiVersion: '2025-05-20'
    })

    await client.request({ method: 'GET', path: '/v1/spaces' })

    expect(calls[0]?.url).toBe('http://127.0.0.1:31012/v1/spaces')
    expect(calls[0]?.init.headers['Anytype-Version']).toBe('2025-05-20')
  })

  test('resolves a 2xx with its parsed body', async () => {
    const { client } = setup(201, '{"challenge_id":"ch_1"}')

    await expect(client.request({ method: 'POST', path: '/v1/auth/challenges' })).resolves.toEqual({
      ok: true,
      status: 201,
      body: { challenge_id: 'ch_1' }
    })
  })

  test('resolves an empty 2xx body as null', async () => {
    const { client } = setup(204)

    await expect(client.request({ method: 'DELETE', path: '/v1/x' })).resolves.toEqual({
      ok: true,
      status: 204,
      body: null
    })
  })

  test('resolves an error status with the code and message Anytype sent', async () => {
    const { client } = setup(
      500,
      '{"object":"error","status":500,"code":"internal_server_error","message":"failed to authenticate user"}'
    )

    await expect(client.request({ method: 'POST', path: '/v1/auth/api_keys' })).resolves.toEqual({
      ok: false,
      status: 500,
      error: { code: 'internal_server_error', message: 'failed to authenticate user' }
    })
  })

  test('resolves an error status whose body lacks the error fields with empty ones', async () => {
    const { client } = setup(404, '["not", "an", "error"]')

    await expect(client.request({ method: 'GET', path: '/v1/x' })).resolves.toEqual({
      ok: false,
      status: 404,
      error: { code: '', message: '' }
    })
  })

  test('rejects when the connection fails', async () => {
    const client = new AnytypeClient({
      fetch: async () => {
        throw new TypeError('fetch failed')
      }
    })

    await expect(client.request({ method: 'GET', path: '/v1/spaces' })).rejects.toThrow('fetch failed')
  })

  test('rejects when something other than JSON answers', async () => {
    const { client } = setup(200, '<html>not anytype</html>')

    await expect(client.request({ method: 'GET', path: '/v1/spaces' })).rejects.toThrow(SyntaxError)
  })
})
