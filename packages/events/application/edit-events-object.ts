import {
  eventsSourceKey,
  newEventsObjectDates,
  rescheduleEventsDatedObject,
  sameEventsObject,
  type EventsApiKeySource,
  type EventsCollectionTarget,
  type EventsDateChanges,
  type EventsDatedObject,
  type EventsEditFailure,
  type EventsEditOutcome,
  type EventsReschedule,
  type EventsSlot,
  type EventsSource,
  type EventsSourceKey,
  type EventsSourceSelection,
  type EventsTimeZone,
  type EventsWriteResult,
  type EventsWriter
} from '../domain'
import type { EventsSpanStore } from './events-span-store'
import type { LoadEventsSpan } from './load-events-span'

export interface EditEventsObjectDeps {
  writer: EventsWriter
  apiKeys: EventsApiKeySource
  sources: EventsSourceSelection
  zone: EventsTimeZone
  store: EventsSpanStore
  /** Read again after every write that lands, so the span shows what Anytype now holds. */
  load: LoadEventsSpan
}

export interface RescheduleEventsObjectInput {
  spaceId: string
  id: string
  change: EventsReschedule
}

export interface CreateEventsObjectInput {
  spaceId: string
  typeKey: string
  name: string
  at: EventsSlot
  /** A collection in the same space to add the new object to. */
  collectionId?: string
}

export interface CompleteEventsObjectInput {
  spaceId: string
  id: string
  done: boolean
}

const GONE = { ok: false, failure: 'gone' } as const
const INVALID = { ok: false, failure: 'invalid' } as const

/**
 * Moves an object on the span, or sets or clears its To date, keeping it drawn so while Anytype
 * is asked.
 */
export class RescheduleEventsObject {
  readonly #deps: EditEventsObjectDeps

  constructor(deps: EditEventsObjectDeps) {
    this.#deps = deps
  }

  async execute({ spaceId, id, change }: RescheduleEventsObjectInput): Promise<EventsEditOutcome> {
    const found = shownObject(this.#deps, spaceId, id)
    if (!found) return GONE
    const { object, source } = found
    const moved = rescheduleEventsDatedObject(object, change, this.#deps.zone)
    if (!moved) return INVALID

    const { from, to } = source
    let dates: EventsDateChanges
    if (change.kind === 'move') {
      dates = { [from]: moved.start }
      // An object with no To value keeps none: it is moved as the single date it is drawn as.
      if (to !== null && moved.end !== null) dates[to] = moved.end
    } else if (to === null || to === from) {
      // Its To is its From, or it has none: it has no end of its own to set or clear.
      return INVALID
    } else dates = { [to]: moved.end }
    return writeThenLoad(this.#deps, moved, (apiKey) =>
      this.#deps.writer.reschedule(apiKey, { spaceId, id }, dates)
    )
  }
}

/**
 * Only as one of the chosen types: that is what says which dates place it. v2 cannot create
 * into a collection, so the object is created, then added; an add that fails leaves it created,
 * since it is still wanted, and says so in the outcome.
 */
export class CreateEventsObject {
  readonly #deps: EditEventsObjectDeps

  constructor(deps: EditEventsObjectDeps) {
    this.#deps = deps
  }

  async execute({ spaceId, typeKey, name, at, collectionId }: CreateEventsObjectInput): Promise<EventsEditOutcome> {
    const { writer, sources, zone } = this.#deps
    const source = sources
      .current()
      .find((candidate) => candidate.kind === 'type' && candidate.spaceId === spaceId && candidate.typeKey === typeKey)
    if (source?.kind !== 'type') return GONE
    const dates = newEventsObjectDates(source, at, zone)
    return writeThenLoad(
      this.#deps,
      null,
      (apiKey) => writer.create(apiKey, { spaceId, typeKey, name, dates }),
      collectionId === undefined
        ? undefined
        : (apiKey, { id }) => addToCollection(writer, apiKey, { spaceId, collectionId }, id)
    )
  }
}

/** Ticks or clears an object's Done, drawing it so while Anytype is asked. */
export class CompleteEventsObject {
  readonly #deps: EditEventsObjectDeps

  constructor(deps: EditEventsObjectDeps) {
    this.#deps = deps
  }

  async execute({ spaceId, id, done }: CompleteEventsObjectInput): Promise<EventsEditOutcome> {
    const found = shownObject(this.#deps, spaceId, id)
    if (!found) return GONE
    const { object, source } = found
    const key = source.done
    if (key === undefined) return INVALID
    return writeThenLoad(this.#deps, { ...object, done }, (apiKey) =>
      this.#deps.writer.setDone(apiKey, { spaceId, id }, key, done)
    )
  }
}

async function addToCollection(
  writer: EventsWriter,
  apiKey: string,
  collection: EventsCollectionTarget,
  objectId: string
): Promise<EventsEditFailure | null> {
  let added: EventsWriteResult
  try {
    added = await writer.addToCollection(apiKey, collection, objectId)
  } catch {
    return { failure: 'unreachable' }
  }
  if (added.ok) return null
  const { ok: _, ...failure } = added
  return failure
}

/**
 * The object as shown — a second drag starts where the first left it, not where Anytype last
 * had it — and the pick it was read through, which names its dates.
 */
function shownObject(
  { store, sources }: EditEventsObjectDeps,
  spaceId: string,
  id: string
): { object: EventsDatedObject; source: EventsSource } | null {
  const shown = store.shown()
  const objects = shown.phase === 'idle' ? [] : (shown.last?.objects ?? [])
  // Of the copies a type and a query each read, the one the lowest-ranked pick places.
  const object = objects
    .filter((candidate) => sameEventsObject(candidate, { spaceId, id }))
    .reduce<EventsDatedObject | null>((first, copy) => (first && first.rank <= copy.rank ? first : copy), null)
  if (!object) return null
  const source = sources
    .current()
    .find((candidate) => candidate.spaceId === spaceId && sameSourceKey(eventsSourceKey(candidate), object.source))
  return source ? { object, source } : null
}

function sameSourceKey(a: EventsSourceKey, b: EventsSourceKey): boolean {
  return a.kind === 'type' ? b.kind === 'type' && a.typeKey === b.typeKey : b.kind === 'query' && a.queryId === b.queryId
}

/**
 * `edit` is drawn from before the write until the span has been read again after it, so the
 * object never shows where it was in between; a refused write drops it at once. `then` follows
 * a write that landed, before the span is read again, and says why it failed, if it did.
 */
async function writeThenLoad<T>(
  { apiKeys, store, load }: EditEventsObjectDeps,
  edit: EventsDatedObject | null,
  write: (apiKey: string) => Promise<EventsWriteResult<T>>,
  then?: (apiKey: string, written: T) => Promise<EventsEditFailure | null>
): Promise<EventsEditOutcome> {
  const release = edit ? store.hold(edit) : () => {}
  try {
    const apiKey = await apiKeys.current()
    if (apiKey === null) return { ok: false, failure: 'unauthorized' }
    let result: EventsWriteResult<T>
    try {
      result = await write(apiKey)
    } catch {
      return { ok: false, failure: 'unreachable' }
    }
    if (!result.ok) return result
    const failed = then ? await then(apiKey, result.value) : null
    await load.execute()
    return failed ? { ok: true, collection: failed } : { ok: true }
  } finally {
    release()
  }
}
