import { DispatchGuard } from '@anytype-calendar/kernel/application'
import { nextEventsMonthLoad, type EventsMonthLoad, type EventsMonthLoadEvent } from '../domain'
import type { EventsMonthStore } from './events-month-store'

export class ResetEventsMonth {
  readonly #guard: DispatchGuard<EventsMonthLoad, EventsMonthLoadEvent>

  constructor(store: EventsMonthStore) {
    this.#guard = new DispatchGuard(store, nextEventsMonthLoad)
  }

  execute(): void {
    this.#guard.dispatch({ type: 'reset' })
  }
}
