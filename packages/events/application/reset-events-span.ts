import { DispatchGuard } from '@anytype-calendar/kernel/application'
import { type EventsSpanLoad, type EventsSpanLoadEvent, nextEventsSpanLoad } from '../domain'
import type { EventsSpanStore } from './events-span-store'

export class ResetEventsSpan {
  readonly #guard: DispatchGuard<EventsSpanLoad, EventsSpanLoadEvent>

  constructor(store: EventsSpanStore) {
    this.#guard = new DispatchGuard(store, nextEventsSpanLoad)
  }

  execute(): void {
    this.#guard.dispatch({ type: 'reset' })
  }
}
