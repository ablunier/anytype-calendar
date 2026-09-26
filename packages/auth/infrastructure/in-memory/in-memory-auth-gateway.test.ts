import { describe, expect, test } from 'vitest'
import { InMemoryAuthGateway, type InMemoryAuthGatewayOptions } from './in-memory-auth-gateway'

function setup(options: Partial<InMemoryAuthGatewayOptions> = {}) {
  const slept: number[] = []
  const logs: string[] = []
  let ids = 0
  const gateway = new InMemoryAuthGateway({
    sleep: async (ms) => {
      slept.push(ms)
    },
    log: (message) => logs.push(message),
    randomId: () => `id${++ids}`,
    ...options
  })
  return { gateway, slept, logs }
}

describe('createChallenge', () => {
  test('opens a challenge and logs the code the user would see in Anytype', async () => {
    const { gateway, slept, logs } = setup()

    await expect(gateway.createChallenge('Calendar')).resolves.toBe('ch_id1')
    expect(logs).toEqual([
      '[in-memory anytype] "Calendar" asks to connect — challenge ch_id1, code 2749'
    ])
    expect(slept).toEqual([300])
  })
})

describe('exchangeCode', () => {
  test('issues a key for the accepted code, after the exchange latency', async () => {
    const { gateway, slept } = setup()
    const challengeId = await gateway.createChallenge('Calendar')

    await expect(gateway.exchangeCode(challengeId, '2749')).resolves.toEqual({
      ok: true,
      apiKey: 'ak_mock_id2',
      access: { apiVersion: 'v2', grant: { allSpaces: true, spaceIds: [], permission: 'readwrite' } }
    })
    expect(slept).toEqual([300, 1_200])
  })

  test('rejects a wrong code, leaving the challenge open for another try', async () => {
    const { gateway } = setup()
    const challengeId = await gateway.createChallenge('Calendar')

    await expect(gateway.exchangeCode(challengeId, '1111')).resolves.toEqual({
      ok: false,
      failure: 'invalid-code'
    })
    await expect(gateway.exchangeCode(challengeId, '2749')).resolves.toMatchObject({ ok: true })
  })

  test('a challenge is consumed by a successful exchange', async () => {
    const { gateway } = setup()
    const challengeId = await gateway.createChallenge('Calendar')
    await gateway.exchangeCode(challengeId, '2749')

    await expect(gateway.exchangeCode(challengeId, '2749')).resolves.toEqual({
      ok: false,
      failure: 'invalid-code'
    })
  })

  test('rejects a challenge it never opened', async () => {
    const { gateway } = setup()
    await expect(gateway.exchangeCode('ch_unknown', '2749')).resolves.toEqual({
      ok: false,
      failure: 'invalid-code'
    })
  })

  test('honours a configured code and latency', async () => {
    const { gateway, slept } = setup({ acceptedCode: '0000', exchangeLatencyMs: 5 })
    const challengeId = await gateway.createChallenge('Calendar')

    await expect(gateway.exchangeCode(challengeId, '2749')).resolves.toMatchObject({ ok: false })
    await expect(gateway.exchangeCode(challengeId, '0000')).resolves.toMatchObject({ ok: true })
    expect(slept).toEqual([300, 5, 5])
  })
})

describe('verifyApiKey', () => {
  test('accepts the default fake key, after the exchange latency', async () => {
    const { gateway, slept } = setup()

    await expect(gateway.verifyApiKey('ak_fake_2749')).resolves.toEqual({
      ok: true,
      access: { apiVersion: 'v2', grant: { allSpaces: true, spaceIds: [], permission: 'readwrite' } }
    })
    expect(slept).toEqual([1_200])
  })

  test('accepts a key it issued, even in an earlier run', async () => {
    const { gateway } = setup()
    await expect(gateway.verifyApiKey('ak_mock_abc123')).resolves.toMatchObject({ ok: true })
  })

  test('rejects any other key', async () => {
    const { gateway } = setup()

    await expect(gateway.verifyApiKey('ak_wrong')).resolves.toEqual({
      ok: false,
      failure: 'invalid-key'
    })
  })

  test('honours a configured key and latency', async () => {
    const { gateway, slept } = setup({ acceptedApiKey: 'ak_custom', exchangeLatencyMs: 5 })

    await expect(gateway.verifyApiKey('ak_fake_2749')).resolves.toMatchObject({ ok: false })
    await expect(gateway.verifyApiKey('ak_custom')).resolves.toMatchObject({ ok: true })
    expect(slept).toEqual([5, 5])
  })
})
