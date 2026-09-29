import { describe, expect, test, vi } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from '@ablunier/anytype-client'
import { AnytypeV2EventsWriter } from './anytype-v2-events-writer'

type FetchCall = { url: string; init: Parameters<AnytypeFetch>[1] }
type Reply = { status: number; body: unknown } | { status: number; text: string } | Error

const API_KEY = 'ak_secret'
const BASE = 'http://127.0.0.1:31009'
const SPACE_ID = 'bafy.space'
const TARGET = { spaceId: SPACE_ID, id: 'bafyobj' }

function setup(...replies: Reply[]) {
  const calls: FetchCall[] = []
  let ids = 0
  const onUnsupported = vi.fn()
  const client = new AnytypeClient({
    randomId: () => `idem-${++ids}`,
    onUnsupported,
    fetch: async (url, init) => {
      calls.push({ url, init })
      const reply = replies[Math.min(calls.length, replies.length) - 1]
      if (!reply) throw new Error('no reply scripted')
      if (reply instanceof Error) throw reply
      const text = 'text' in reply ? reply.text : JSON.stringify(reply.body)
      return { status: reply.status, text: async () => text }
    }
  })
  const writer = new AnytypeV2EventsWriter(client)
  return { writer, onUnsupported, calls }
}

const edited: Reply = { status: 200, body: { etag: 'e2', diff_stats: {} } }

const v2Error = (status: number, code: string, issues: { path: string; message: string }[] = []): Reply => ({
  status,
  body: { status, code, message: `${code} message`, issues }
})

const bodyOf = (call: FetchCall | undefined): unknown => JSON.parse(call?.init.body ?? 'null')

describe('rescheduling', () => {
  test('sets the dates with one set_properties op, in RFC 3339 UTC to the second', async () => {
    const { writer, calls } = setup(edited)

    await expect(
      writer.reschedule(API_KEY, TARGET, {
        start_date: Date.UTC(2026, 8, 16, 14, 0, 0, 750),
        '6a650e02aa': Date.UTC(2026, 8, 16, 15)
      })
    ).resolves.toEqual({ ok: true, value: null })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${BASE}/v2/spaces/bafy.space/objects/bafyobj`)
    expect(calls[0]?.init.method).toBe('PATCH')
    expect(calls[0]?.init.headers).toMatchObject({
      Authorization: `Bearer ${API_KEY}`,
      'Idempotency-Key': 'idem-1'
    })
    expect(bodyOf(calls[0])).toEqual({
      ops: [
        {
          op: 'set_properties',
          set: { start_date: '2026-09-16T14:00:00Z', '6a650e02aa': '2026-09-16T15:00:00Z' }
        }
      ]
    })
  })

  test('sends a write that got no answer once more, under the same Idempotency-Key', async () => {
    const { writer, calls } = setup(new Error('socket hang up'), edited)

    await expect(writer.reschedule(API_KEY, TARGET, { due_date: 0 })).resolves.toEqual({ ok: true, value: null })
    expect(calls.map(({ init }) => init.headers['Idempotency-Key'])).toEqual(['idem-1', 'idem-1'])
  })

  test('gives each write a key of its own', async () => {
    const { writer, calls } = setup(edited)
    await writer.reschedule(API_KEY, TARGET, { due_date: 0 })
    await writer.reschedule(API_KEY, TARGET, { due_date: 0 })
    expect(calls.map(({ init }) => init.headers['Idempotency-Key'])).toEqual(['idem-1', 'idem-2'])
  })

  test('rejects when the write goes unanswered twice', async () => {
    const { writer } = setup(new Error('socket hang up'))
    await expect(writer.reschedule(API_KEY, TARGET, { due_date: 0 })).rejects.toThrow('socket hang up')
  })
})

describe('refusals', () => {
  test.each([
    [{ status: 401, body: { object: 'error', status: 401, code: 'unauthorized', message: 'x' } }, { failure: 'unauthorized' }],
    [{ status: 403, body: { object: 'error', status: 403, code: 'write_not_granted', message: 'x' } }, { failure: 'not-granted' }],
    [v2Error(403, 'space_not_granted'), { failure: 'not-granted' }],
    [{ status: 429, body: { object: 'error', status: 429, code: 'rate_limit_exceeded', message: 'x' } }, { failure: 'rate-limited' }]
  ] as const)('reads %j as %j', async (reply, failure) => {
    const { writer } = setup(reply)
    await expect(writer.setDone(API_KEY, TARGET, 'done', true)).resolves.toEqual({ ok: false, ...failure })
  })

  test("says why Anytype refused a change, in its first issue's words where it names one", async () => {
    const { writer } = setup(
      v2Error(400, 'invalid_input', [{ path: 'ops[0].set.due_date', message: 'due_date is not a date' }]),
      v2Error(404, 'object_not_found')
    )
    await expect(writer.reschedule(API_KEY, TARGET, { due_date: 0 })).resolves.toEqual({
      ok: false,
      failure: 'rejected',
      message: 'due_date is not a date'
    })
    await expect(writer.reschedule(API_KEY, TARGET, { due_date: 0 })).resolves.toEqual({
      ok: false,
      failure: 'rejected',
      message: 'object_not_found message'
    })
  })

  test('reads a bare 404 as an Anytype without v2', async () => {
    const { writer, onUnsupported } = setup({ status: 404, text: '404 page not found' })
    await expect(writer.setDone(API_KEY, TARGET, 'done', false)).resolves.toEqual({
      ok: false,
      failure: 'unsupported'
    })
    expect(onUnsupported).toHaveBeenCalled()
  })

  test('rejects an answer Anytype should never give', async () => {
    const { writer } = setup(v2Error(500, 'internal_server_error'))
    await expect(writer.setDone(API_KEY, TARGET, 'done', true)).rejects.toThrow('500')
  })
})

describe('setting Done', () => {
  test('sets the checkbox to the value asked for', async () => {
    const { writer, calls } = setup(edited)
    await writer.setDone(API_KEY, TARGET, 'done', false)
    expect(bodyOf(calls[0])).toEqual({ ops: [{ op: 'set_properties', set: { done: false } }] })
  })
})

describe('creating', () => {
  test("posts the type, name and dates, and answers the new object's id", async () => {
    const { writer, calls } = setup({ status: 201, body: { id: 'bafynew', etag: 'e1' } })

    await expect(
      writer.create(API_KEY, {
        spaceId: SPACE_ID,
        typeKey: 'meeting',
        name: 'Retro',
        dates: { start_date: Date.UTC(2026, 8, 18, 16), end_date: Date.UTC(2026, 8, 18, 17) }
      })
    ).resolves.toEqual({ ok: true, value: { id: 'bafynew' } })

    expect(calls[0]?.url).toBe(`${BASE}/v2/spaces/bafy.space/objects`)
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.headers['Idempotency-Key']).toBe('idem-1')
    expect(bodyOf(calls[0])).toEqual({
      type: 'meeting',
      name: 'Retro',
      properties: { start_date: '2026-09-18T16:00:00Z', end_date: '2026-09-18T17:00:00Z' }
    })
  })

  test('rejects a creation answered without an id', async () => {
    const { writer } = setup({ status: 201, body: { etag: 'e1' } })
    await expect(
      writer.create(API_KEY, { spaceId: SPACE_ID, typeKey: 'meeting', name: '', dates: {} })
    ).rejects.toThrow('without an id')
  })
})
