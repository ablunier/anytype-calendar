import type { AnytypeClient, AnytypeFailure } from '@ablunier/anytype-client'
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
 * The client sends each write with an `Idempotency-Key`, and once more if it got no answer. No
 * `If-Match`: search rows carry no etag, and sync moves an object's etag often enough that the
 * check would refuse writes nobody raced. The last write wins, as in Anytype's own UI.
 */
export class AnytypeV2EventsWriter implements EventsWriter {
  readonly #client: AnytypeClient

  constructor(client: AnytypeClient) {
    this.#client = client
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
    const response = await this.#client
      .withApiKey(apiKey)
      .objects.create(spaceId, { type: typeKey, name, properties: rfc3339Dates(dates) })
    if (!response.ok) return refusal(response)
    const id = response.body?.id
    if (typeof id !== 'string' || id === '') throw new Error('Anytype created an object without an id')
    return { ok: true, value: { id } }
  }

  async #setProperties(
    apiKey: string,
    { spaceId, id }: EventsObjectTarget,
    set: Record<string, unknown>
  ): Promise<EventsWriteResult> {
    const response = await this.#client
      .withApiKey(apiKey)
      .objects.update(spaceId, id, [{ op: 'set_properties', set }])
    return response.ok ? { ok: true, value: null } : refusal(response)
  }
}

function refusal({ status, error, unsupported }: AnytypeFailure): EventsWriteResult<never> {
  if (status === UNAUTHORIZED) return { ok: false, failure: 'unauthorized' }
  if (status === FORBIDDEN) return { ok: false, failure: 'not-granted' }
  if (status === TOO_MANY_REQUESTS) return { ok: false, failure: 'rate-limited' }
  if (unsupported) return { ok: false, failure: 'unsupported' }
  if (REFUSED_STATUSES.has(status)) {
    // An issue names what was refused; the envelope's message only that something was.
    const message = error.issues[0]?.message || error.message || error.code
    return { ok: false, failure: 'rejected', message }
  }
  throw new Error(`Anytype answered ${status} when asked to write an object`)
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
