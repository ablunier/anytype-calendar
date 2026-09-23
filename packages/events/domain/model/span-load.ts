import type { EventsDatedObject } from './dated-object'
import type { EventsSpan } from './span'

export type EventsLoadFailure =
  /** Anytype is not running, did not answer, or answered with something unusable. */
  | 'unreachable'
  /** No key is stored, or Anytype refused it — usually deleted in Anytype's settings. */
  | 'unauthorized'

export interface EventsSpanResult {
  span: EventsSpan
  /** In the order of compareEventsDatedObjects. */
  objects: EventsDatedObject[]
  /** Epoch milliseconds. */
  loadedAt: number
}

/**
 * `last` is the most recent successful result, whichever span it was for. It survives a
 * new load and a failed one, so a span being read again keeps what was on screen.
 */
export type EventsSpanLoad =
  | { phase: 'idle' }
  | { phase: 'loading'; span: EventsSpan; last?: EventsSpanResult }
  | { phase: 'loaded'; last: EventsSpanResult }
  /** `at` is epoch milliseconds. */
  | { phase: 'failed'; span: EventsSpan; failure: EventsLoadFailure; at: number; last?: EventsSpanResult }

export type EventsSpanLoadPhase = EventsSpanLoad['phase']

export type EventsSpanLoadEvent =
  | { type: 'load-started'; span: EventsSpan }
  | { type: 'load-succeeded'; objects: EventsDatedObject[]; at: number }
  | { type: 'load-failed'; failure: EventsLoadFailure; at: number }
  | { type: 'reset' }

/**
 * An event that does not apply to the current phase returns the state unchanged — the same
 * object, so callers can tell nothing happened. A load started while another runs is not
 * absorbed, unlike a schema sync: it always yields a new state, since the newer one may be
 * for another span or a changed selection, and the older one's result must lose.
 */
export function nextEventsSpanLoad(
  state: EventsSpanLoad,
  event: EventsSpanLoadEvent
): EventsSpanLoad {
  switch (event.type) {
    case 'load-started':
      return withLast({ phase: 'loading', span: event.span }, lastResult(state))

    case 'load-succeeded':
      return state.phase === 'loading'
        ? { phase: 'loaded', last: { span: state.span, objects: event.objects, loadedAt: event.at } }
        : state

    case 'load-failed':
      return state.phase === 'loading'
        ? withLast(
            { phase: 'failed', span: state.span, failure: event.failure, at: event.at },
            state.last
          )
        : state

    case 'reset':
      return state.phase === 'idle' ? state : { phase: 'idle' }
  }
}

/** The span being loaded, last loaded, or that failed; null before any load. */
export function shownEventsSpan(state: EventsSpanLoad): EventsSpan | null {
  switch (state.phase) {
    case 'idle':
      return null
    case 'loaded':
      return state.last.span
    case 'loading':
    case 'failed':
      return state.span
  }
}

function lastResult(state: EventsSpanLoad): EventsSpanResult | undefined {
  return state.phase === 'idle' ? undefined : state.last
}

/** `exactOptionalPropertyTypes` forbids `last: undefined`, so an absent result is left off. */
function withLast<T extends EventsSpanLoad>(state: T, last: EventsSpanResult | undefined): T {
  return last ? { ...state, last } : state
}
