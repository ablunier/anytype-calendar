import type { EventsWindow } from '../model/window'
import type { EventsSource } from '../model/source'

export interface EventsObjectRef {
  id: string
  title: string
  /** Epoch milliseconds: the From value. */
  start: number
  /** Epoch milliseconds: the To value; null when the source has no To property or the object leaves it empty. */
  end: number | null
  /** Each left off where the source has no such property, the object no value for it, or the API does not read it (v1). */
  done?: boolean
  location?: string
  /** The name of the option picked in the source's `colourBy` property. */
  option?: string
}

/**
 * A refused key is an expected answer, not an error, so it is a value; only a transport
 * breakdown or a response Anytype should never give rejects the promise.
 */
export type EventsGatewayResult<T> = { ok: true; value: T } | { ok: false; failure: 'unauthorized' }

export interface EventsGateway {
  /**
   * The source's objects that have a From value and may overlap the window: every one that
   * does, and possibly some that do not — Anytype compares dates by whole days — so callers
   * check the overlap themselves. Leaves out archived objects.
   */
  listObjects(
    apiKey: string,
    source: EventsSource,
    window: EventsWindow
  ): Promise<EventsGatewayResult<EventsObjectRef[]>>
}
