import { describe, expect, test } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from '../http/anytype-client'
import { AnytypeDialectProbe, type AnytypeDialect } from './anytype-dialect'

type Reply = { status: number; text: string }

const WHOAMI = { grant: { restricted: false }, api: { version: '2' } }
const V2: Reply = { status: 200, text: JSON.stringify(WHOAMI) }
const NO_ROUTE: Reply = { status: 404, text: '404 page not found' }
const REFUSED: Reply = { status: 401, text: '{"object":"error","status":401,"code":"unauthorized","message":"x"}' }

function setup(replies: Reply[], forced?: AnytypeDialect) {
  const urls: string[] = []
  const fetch: AnytypeFetch = async (url) => {
    urls.push(url)
    const reply = replies[Math.min(urls.length, replies.length) - 1]
    if (!reply) throw new Error('no reply scripted')
    return { status: reply.status, text: async () => reply.text }
  }
  const client = new AnytypeClient({ fetch })
  return { probe: new AnytypeDialectProbe(forced ? { client, forced } : { client }), urls }
}

describe('probe', () => {
  test('reads v2 from an answered whoami, and keeps what it said', async () => {
    const { probe, urls } = setup([V2])

    await expect(probe.probe('ak')).resolves.toEqual({ ok: true, dialect: 'v2', whoami: WHOAMI })
    expect(urls).toEqual(['http://127.0.0.1:31009/v2/auth/whoami?ids=full&spaces=true'])
  })

  test('reads v1 from a route Anytype does not have', async () => {
    const { probe } = setup([NO_ROUTE])

    await expect(probe.probe('ak')).resolves.toEqual({ ok: true, dialect: 'v1', whoami: null })
  })

  test("does not read v1 from a v2 handler's own 404", async () => {
    const { probe } = setup([{ status: 404, text: '{"status":404,"code":"not_found","message":"x","issues":[]}' }])

    await expect(probe.probe('ak')).rejects.toThrow('404')
  })

  test('reads a refused key as unauthorized, and asks again next time', async () => {
    const { probe, urls } = setup([REFUSED, V2])

    await expect(probe.probe('ak')).resolves.toEqual({ ok: false, failure: 'unauthorized' })
    await expect(probe.probe('ak')).resolves.toMatchObject({ ok: true, dialect: 'v2' })
    expect(urls).toHaveLength(2)
  })

  test('asks once for concurrent probes of one key', async () => {
    const { probe, urls } = setup([V2])

    await Promise.all([probe.probe('ak'), probe.probe('ak')])
    await probe.probe('ak')

    expect(urls).toHaveLength(1)
  })

  test('asks again for another key, or once forgotten', async () => {
    const { probe, urls } = setup([V2])

    await probe.probe('ak')
    await probe.probe('ak_other')
    probe.forget()
    await probe.probe('ak_other')

    expect(urls).toHaveLength(3)
  })

  test('asks again after a failed request', async () => {
    const { probe, urls } = setup([{ status: 500, text: '{}' }, V2])

    await expect(probe.probe('ak')).rejects.toThrow('500')
    await expect(probe.probe('ak')).resolves.toMatchObject({ dialect: 'v2' })
    expect(urls).toHaveLength(2)
  })

  test('answers a forced v1 without asking', async () => {
    const { probe, urls } = setup([V2], 'v1')

    await expect(probe.probe('ak')).resolves.toEqual({ ok: true, dialect: 'v1', whoami: null })
    expect(urls).toEqual([])
  })

  test('forces v1 from when it is set, and asks again once unset', async () => {
    const { probe, urls } = setup([V2, V2])

    await expect(probe.probe('ak')).resolves.toMatchObject({ dialect: 'v2' })
    probe.setForced('v1')
    await expect(probe.probe('ak')).resolves.toMatchObject({ dialect: 'v1' })
    probe.setForced(undefined)
    await expect(probe.probe('ak')).resolves.toMatchObject({ dialect: 'v2' })
    expect(urls).toHaveLength(2)
  })

  test('refuses a forced v2 that Anytype does not serve', async () => {
    const { probe } = setup([NO_ROUTE], 'v2')

    await expect(probe.probe('ak')).rejects.toThrow('404')
  })
})
