import { DispatchGuard } from '@anytype-calendar/kernel/application'
import {
  compareEventsDatedObjects,
  eventsMonthWindow,
  nextEventsMonthLoad,
  overlapsEventsWindow,
  shownEventsMonth,
  toEventsDatedObject,
  type EventsApiKeySource,
  type EventsDatedObject,
  type EventsGateway,
  type EventsMonth,
  type EventsMonthLoad,
  type EventsMonthLoadEvent,
  type EventsSourceSelection,
  type EventsTimeZone
} from '../domain'
import type { EventsMonthStore } from './events-month-store'

export interface LoadEventsMonthDeps {
  gateway: EventsGateway
  apiKeys: EventsApiKeySource
  sources: EventsSourceSelection
  zone: EventsTimeZone
  store: EventsMonthStore
  now?: () => number
}

/** Thrown inside a load to stop it at the first refused request. */
class Unauthorized extends Error {}

/**
 * The newest load wins. Each one starts a fresh `loading` state and applies its result only
 * if the store still holds it, so a month the user already left, a load a reload replaced,
 * or one a reset cut short never overwrites what came after it.
 */
export class LoadEventsMonth {
  readonly #gateway: EventsGateway
  readonly #apiKeys: EventsApiKeySource
  readonly #sources: EventsSourceSelection
  readonly #zone: EventsTimeZone
  readonly #guard: DispatchGuard<EventsMonthLoad, EventsMonthLoadEvent>
  readonly #now: () => number

  constructor({ gateway, apiKeys, sources, zone, store, now = Date.now }: LoadEventsMonthDeps) {
    this.#gateway = gateway
    this.#apiKeys = apiKeys
    this.#sources = sources
    this.#zone = zone
    this.#guard = new DispatchGuard(store, nextEventsMonthLoad)
    this.#now = now
  }

  /** Without a month, reads the one on screen again, or the current month before any. */
  async execute(month?: EventsMonth): Promise<void> {
    const target = month ?? shownEventsMonth(this.#guard.current()) ?? this.#currentMonth()
    const loading = this.#guard.dispatch({ type: 'load-started', month: target })

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

  async #fetchObjects(month: EventsMonth): Promise<EventsDatedObject[]> {
    const window = eventsMonthWindow(month, this.#zone)
    const sources = this.#sources.current()
    const apiKey = await this.#apiKeys.current()
    if (apiKey === null) throw new Unauthorized()

    const perSource = await Promise.all(
      sources.map(async (source) => {
        const result = await this.#gateway.listObjects(apiKey, source, window)
        if (!result.ok) throw new Unauthorized()
        return result.value
          .map((ref) => toEventsDatedObject(ref, source, this.#zone))
          .filter((object) => overlapsEventsWindow(object, window))
      })
    )
    return perSource.flat().sort(compareEventsDatedObjects)
  }

  #currentMonth(): EventsMonth {
    const { year, month } = this.#zone.dayOf(this.#now())
    return { year, month }
  }
}
