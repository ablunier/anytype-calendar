import type { EventsDatedObject } from './dated-object'
import type { EventsMonth } from './month'

export type EventsLoadFailure =
  /** Anytype is not running, did not answer, or answered with something unusable. */
  | 'unreachable'
  /** No key is stored, or Anytype refused it — usually deleted in Anytype's settings. */
  | 'unauthorized'

export interface EventsMonthResult {
  month: EventsMonth
  /** In the order of compareEventsDatedObjects. */
  objects: EventsDatedObject[]
  /** Epoch milliseconds. */
  loadedAt: number
}

/**
 * `last` is the most recent successful result, whichever month it was for. It survives a
 * new load and a failed one, so a month being read again keeps what was on screen.
 */
export type EventsMonthLoad =
  | { phase: 'idle' }
  | { phase: 'loading'; month: EventsMonth; last?: EventsMonthResult }
  | { phase: 'loaded'; last: EventsMonthResult }
  /** `at` is epoch milliseconds. */
  | { phase: 'failed'; month: EventsMonth; failure: EventsLoadFailure; at: number; last?: EventsMonthResult }

export type EventsMonthLoadPhase = EventsMonthLoad['phase']

export type EventsMonthLoadEvent =
  | { type: 'load-started'; month: EventsMonth }
  | { type: 'load-succeeded'; objects: EventsDatedObject[]; at: number }
  | { type: 'load-failed'; failure: EventsLoadFailure; at: number }
  | { type: 'reset' }

/**
 * An event that does not apply to the current phase returns the state unchanged — the same
 * object, so callers can tell nothing happened. A load started while another runs is not
 * absorbed, unlike a schema sync: it always yields a new state, since the newer one may be
 * for another month or a changed selection, and the older one's result must lose.
 */
export function nextEventsMonthLoad(
  state: EventsMonthLoad,
  event: EventsMonthLoadEvent
): EventsMonthLoad {
  switch (event.type) {
    case 'load-started':
      return withLast({ phase: 'loading', month: event.month }, lastResult(state))

    case 'load-succeeded':
      return state.phase === 'loading'
        ? { phase: 'loaded', last: { month: state.month, objects: event.objects, loadedAt: event.at } }
        : state

    case 'load-failed':
      return state.phase === 'loading'
        ? withLast(
            { phase: 'failed', month: state.month, failure: event.failure, at: event.at },
            state.last
          )
        : state

    case 'reset':
      return state.phase === 'idle' ? state : { phase: 'idle' }
  }
}

/** The month being loaded, last loaded, or that failed; null before any load. */
export function shownEventsMonth(state: EventsMonthLoad): EventsMonth | null {
  switch (state.phase) {
    case 'idle':
      return null
    case 'loaded':
      return state.last.month
    case 'loading':
    case 'failed':
      return state.month
  }
}

function lastResult(state: EventsMonthLoad): EventsMonthResult | undefined {
  return state.phase === 'idle' ? undefined : state.last
}

/** `exactOptionalPropertyTypes` forbids `last: undefined`, so an absent result is left off. */
function withLast<T extends EventsMonthLoad>(state: T, last: EventsMonthResult | undefined): T {
  return last ? { ...state, last } : state
}
