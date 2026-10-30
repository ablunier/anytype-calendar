import type { EventsDetailRef, EventsLinkedObject } from '../model/detail'
import type { EventsWindow } from '../model/window'
import type { EventsSource } from '../model/source'

export interface EventsObjectRef {
  id: string
  title: string
  /** Epoch milliseconds: the From value. */
  start: number
  /** Epoch milliseconds: the To value; null when the source has no To property or the object leaves it empty. */
  end: number | null
  /** Each left off where the source has no such property, or the object no value for it. */
  done?: boolean
  location?: string
  /** The name of the option picked in the source's `colourBy` property. */
  option?: string
  /** The source's `panel` properties the object has a value for, in no particular order. */
  details?: EventsDetailRef[]
}

/**
 * A refused key, or an Anytype too old to serve v2 of its API, is an expected answer, not an
 * error, so it is a value; only a transport breakdown or a response Anytype should never give
 * rejects the promise.
 */
export type EventsGatewayResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: 'unauthorized' | 'outdated' }

export interface EventsGateway {
  /**
   * The source's objects that have a From value and may overlap the window: every one that
   * does, and possibly some that do not — Anytype compares dates by whole days, and a query
   * cannot be narrowed by date at all — so callers check the overlap themselves. Leaves out
   * archived objects. A query, or a view of one, that is gone holds no objects.
   */
  listObjects(
    apiKey: string,
    source: EventsSource,
    window: EventsWindow
  ): Promise<EventsGatewayResult<EventsObjectRef[]>>

  /**
   * The objects and space members of the space with these ids, for their names. One that is
   * gone, or cannot be read, is left out.
   */
  listLinkedObjects(
    apiKey: string,
    spaceId: string,
    ids: readonly string[]
  ): Promise<EventsGatewayResult<EventsLinkedObject[]>>
}
