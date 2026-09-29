import {
  isUnmatchedRoute,
  type AnytypeClient,
  type AnytypeDialectProbe,
  type AnytypeRequest,
  type AnytypeResponse
} from '@anytype-calendar/anytype-client/infrastructure'
import type {
  EventsDateValues,
  EventsNewObject,
  EventsObjectTarget,
  EventsWriteResult,
  EventsWriter
} from '../../domain'

const UNAUTHORIZED = 401
/** `write_not_granted` for a read-only key, `space_not_granted` for a space outside its grant. */
const FORBIDDEN = 403
const TOO_MANY_REQUESTS = 429
/** A bad value, a gone object or property, a conflict, or content v2 cannot edit losslessly. */
const REFUSED_STATUSES = new Set([400, 404, 409, 422])

/**
 * Writes through v2 alone: v1 has no writes. An object's properties are set with one
 * `set_properties` op; dates go as RFC 3339 in UTC, the spelling Anytype reads them back in.
 *
 * Every write carries an `Idempotency-Key`, and one that never got an answer is sent once more
 * with the same key, so Anytype replays rather than repeats it if the first did land. No
 * `If-Match`: search rows carry no etag, and sync moves an object's etag often enough that the
 * check would refuse writes nobody raced. The last write wins, as in Anytype's own UI.
 */
export class AnytypeV2EventsWriter implements EventsWriter {
  readonly #client: AnytypeClient
  readonly #probe: AnytypeDialectProbe
  readonly #randomId: () => string

  constructor({
    client,
    probe,
    randomId
  }: {
    client: AnytypeClient
    probe: AnytypeDialectProbe
    randomId: () => string
  }) {
    this.#client = client
    this.#probe = probe
    this.#randomId = randomId
  }

  reschedule(apiKey: string, target: EventsObjectTarget, dates: EventsDateValues): Promise<EventsWriteResult> {
    return this.#setProperties(apiKey, target, rfc3339Dates(dates))
  }

  setDone(apiKey: string, target: EventsObjectTarget, key: string, done: boolean): Promise<EventsWriteResult> {
    return this.#setProperties(apiKey, target, { [key]: done })
  }

  async create(
    apiKey: string,
    { spaceId, typeKey, name, dates }: EventsNewObject
  ): Promise<EventsWriteResult<{ id: string }>> {
    const response = await this.#send({
      method: 'POST',
      path: `${spacePath(spaceId)}/objects`,
      apiKey,
      body: { type: typeKey, name, properties: rfc3339Dates(dates) }
    })
    if (!response.ok) return this.#refusal(response)
    const id = field(response.body, 'id')
    if (typeof id !== 'string' || id === '') throw new Error('Anytype created an object without an id')
    return { ok: true, value: { id } }
  }

  async #setProperties(
    apiKey: string,
    { spaceId, id }: EventsObjectTarget,
    set: Record<string, unknown>
  ): Promise<EventsWriteResult> {
    const response = await this.#send({
      method: 'PATCH',
      path: `${spacePath(spaceId)}/objects/${encodeURIComponent(id)}`,
      apiKey,
      body: { ops: [{ op: 'set_properties', set }] }
    })
    return response.ok ? { ok: true, value: null } : this.#refusal(response)
  }

  async #send(request: AnytypeRequest): Promise<AnytypeResponse> {
    const keyed = { ...request, headers: { 'Idempotency-Key': this.#randomId() } }
    try {
      return await this.#client.request(keyed)
    } catch {
      return this.#client.request(keyed)
    }
  }

  #refusal(response: Extract<AnytypeResponse, { ok: false }>): EventsWriteResult<never> {
    const { status, error } = response
    if (status === UNAUTHORIZED) return { ok: false, failure: 'unauthorized' }
    if (status === FORBIDDEN) return { ok: false, failure: 'not-granted' }
    if (status === TOO_MANY_REQUESTS) return { ok: false, failure: 'rate-limited' }
    if (isUnmatchedRoute(response)) {
      this.#probe.forget()
      return { ok: false, failure: 'unsupported' }
    }
    if (REFUSED_STATUSES.has(status)) {
      // An issue names what was refused; the envelope's message only that something was.
      const message = error.issues[0]?.message || error.message || error.code
      return { ok: false, failure: 'rejected', message }
    }
    throw new Error(`Anytype answered ${status} when asked to write an object`)
  }
}

function spacePath(spaceId: string): string {
  return `/v2/spaces/${encodeURIComponent(spaceId)}`
}

/** Whole seconds: that is all Anytype keeps of a date. */
function rfc3339Dates(dates: EventsDateValues): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dates).map(([key, instant]) => [
      key,
      new Date(Math.floor(instant / 1000) * 1000).toISOString().replace('.000Z', 'Z')
    ])
  )
}

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[name]
    : undefined
}
