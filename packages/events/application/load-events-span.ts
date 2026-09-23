import { DispatchGuard } from '@anytype-calendar/kernel/application'
import {
  compareEventsDatedObjects,
  eventsSpanWindow,
  nextEventsSpanLoad,
  overlapsEventsWindow,
  shownEventsSpan,
  toEventsDatedObject,
  type EventsApiKeySource,
  type EventsDatedObject,
  type EventsGateway,
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
class Unauthorized extends Error {}

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
      const failure = error instanceof Unauthorized ? 'unauthorized' : 'unreachable'
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
    if (apiKey === null) throw new Unauthorized()

    const perSource = await Promise.all(
      sources.map(async (source) => {
        const result = await this.#gateway.listObjects(apiKey, source, window)
        if (!result.ok) throw new Unauthorized()
        return result.value
          .map((ref) => toEventsDatedObject(ref, source))
          .filter((object) => overlapsEventsWindow(object, window))
      })
    )
    return perSource.flat().sort(compareEventsDatedObjects)
  }

  #openingSpan(): EventsSpan {
    if (this.#defaultSpan) return this.#defaultSpan()
    const { year, month } = this.#zone.dayOf(this.#now())
    return { kind: 'month', year, month }
  }
}
