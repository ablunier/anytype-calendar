import { DispatchGuard } from '@anytype-calendar/kernel/application'
import {
  compareEventsDatedObjects,
  eventsSpanWindow,
  linkedEventsIds,
  nextEventsSpanLoad,
  overlapsEventsWindow,
  shownEventsSpan,
  toEventsDatedObject,
  type EventsApiKeySource,
  type EventsDatedObject,
  type EventsGateway,
  type EventsLinkedObject,
  type EventsObjectRef,
  type EventsSource,
  type EventsSourceSelection,
  type EventsSpan,
  type EventsSpanLoad,
  type EventsSpanLoadEvent,
  type EventsTimeZone
} from '../domain'
import type { EventsSpanStore } from './events-span-store'

export interface LoadEventsSpanDeps {
  gateway: EventsGateway
  apiKeys: EventsApiKeySource
  sources: EventsSourceSelection
  zone: EventsTimeZone
  store: EventsSpanStore
  /**
   * What a first load reads, before the renderer has asked for anything: the composition root
   * supplies the view the user last chose, so a launch opens on it rather than on a month it
   * would immediately have to replace.
   */
  defaultSpan?: () => EventsSpan
  now?: () => number
}

/** Thrown inside a load to stop it at the first refused request. */
class Refused extends Error {
  readonly failure: 'unauthorized' | 'outdated'

  constructor(failure: 'unauthorized' | 'outdated') {
    super(failure)
    this.failure = failure
  }
}

/**
 * The newest load wins. Each one starts a fresh `loading` state and applies its result only
 * if the store still holds it, so a span the user already left, a load a reload replaced,
 * or one a reset cut short never overwrites what came after it.
 */
export class LoadEventsSpan {
  readonly #gateway: EventsGateway
  readonly #apiKeys: EventsApiKeySource
  readonly #sources: EventsSourceSelection
  readonly #zone: EventsTimeZone
  readonly #guard: DispatchGuard<EventsSpanLoad, EventsSpanLoadEvent>
  readonly #defaultSpan: (() => EventsSpan) | undefined
  readonly #now: () => number

  constructor({
    gateway,
    apiKeys,
    sources,
    zone,
    store,
    defaultSpan,
    now = Date.now
  }: LoadEventsSpanDeps) {
    this.#gateway = gateway
    this.#apiKeys = apiKeys
    this.#sources = sources
    this.#zone = zone
    this.#guard = new DispatchGuard(store, nextEventsSpanLoad)
    this.#defaultSpan = defaultSpan
    this.#now = now
  }

  /** Without a span, reads the one on screen again, or the opening one before any. */
  async execute(span?: EventsSpan): Promise<void> {
    const target = span ?? shownEventsSpan(this.#guard.current()) ?? this.#openingSpan()
    const loading = this.#guard.dispatch({ type: 'load-started', span: target })

    let objects: EventsDatedObject[]
    try {
      objects = await this.#fetchObjects(target)
    } catch (error) {
      const failure = error instanceof Refused ? error.failure : 'unreachable'
      if (this.#guard.isCurrent(loading)) {
        this.#guard.dispatch({ type: 'load-failed', failure, at: this.#now() })
      }
      return
    }
    if (this.#guard.isCurrent(loading)) {
      this.#guard.dispatch({ type: 'load-succeeded', objects, at: this.#now() })
    }
  }

  async #fetchObjects(span: EventsSpan): Promise<EventsDatedObject[]> {
    const window = eventsSpanWindow(span, this.#zone)
    const sources = this.#sources.current()
    const apiKey = await this.#apiKeys.current()
    if (apiKey === null) throw new Refused('unauthorized')

    const perSource = await Promise.all(
      sources.map(async (source, rank) => {
        const result = await this.#gateway.listObjects(apiKey, source, window)
        if (!result.ok) throw new Refused(result.failure)
        return { source, rank, refs: result.value }
      })
    )
    const linked = await this.#fetchLinked(apiKey, perSource)
    const objects = perSource.flatMap(({ source, rank, refs }) =>
      refs
        .map((ref) => toEventsDatedObject(ref, source, rank, (id) => linked.get(`${source.spaceId}\n${id}`)))
        .filter((object) => overlapsEventsWindow(object, window))
    )
    return objects.sort(compareEventsDatedObjects)
  }

  /**
   * By space id and object id, what the span's objects link to: read once per space, for every
   * id linked from it, rather than once per object.
   */
  async #fetchLinked(
    apiKey: string,
    perSource: readonly { source: EventsSource; refs: readonly EventsObjectRef[] }[]
  ): Promise<Map<string, EventsLinkedObject>> {
    const idsBySpace = new Map<string, Set<string>>()
    for (const { source, refs } of perSource) {
      const ids = idsBySpace.get(source.spaceId) ?? new Set<string>()
      for (const ref of refs) for (const id of linkedEventsIds(ref.details ?? [])) ids.add(id)
      if (ids.size > 0) idsBySpace.set(source.spaceId, ids)
    }
    const perSpace = await Promise.all(
      [...idsBySpace].map(async ([spaceId, ids]) => {
        const result = await this.#gateway.listLinkedObjects(apiKey, spaceId, [...ids])
        if (!result.ok) throw new Refused(result.failure)
        return result.value.map((object): [string, EventsLinkedObject] => [`${spaceId}\n${object.id}`, object])
      })
    )
    return new Map(perSpace.flat())
  }

  #openingSpan(): EventsSpan {
    if (this.#defaultSpan) return this.#defaultSpan()
    const { year, month } = this.#zone.dayOf(this.#now())
    return { kind: 'month', year, month }
  }
}
