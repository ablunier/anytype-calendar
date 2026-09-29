export interface EventsObjectTarget {
  spaceId: string
  /** Anytype's object id. */
  id: string
}

/** Epoch milliseconds by date property key. */
export type EventsDateValues = Record<string, number>

export interface EventsNewObject {
  spaceId: string
  typeKey: string
  /** May be empty: Anytype shows such an object as untitled. */
  name: string
  dates: EventsDateValues
}

/**
 * Why Anytype would not take a write. A refusal is an expected answer, not an error, so it is
 * a value; only a transport breakdown or a response Anytype should never give rejects.
 */
export type EventsWriteFailure =
  /** Anytype refused the key itself. */
  | { failure: 'unauthorized' }
  /** The key may not write, or not to this space. */
  | { failure: 'not-granted' }
  | { failure: 'rate-limited' }
  /** This Anytype takes no writes through the API: it serves only v1. */
  | { failure: 'unsupported' }
  /** Anytype refused the change itself, e.g. an object that is gone; `message` says why, in its words. */
  | { failure: 'rejected'; message: string }

export type EventsWriteResult<T = null> = ({ ok: true; value: T }) | ({ ok: false } & EventsWriteFailure)

export interface EventsWriter {
  /** Sets each date to its instant; dates not named keep theirs. */
  reschedule(apiKey: string, target: EventsObjectTarget, dates: EventsDateValues): Promise<EventsWriteResult>
  create(apiKey: string, object: EventsNewObject): Promise<EventsWriteResult<{ id: string }>>
  /** `key` is the object's Done checkbox. */
  setDone(apiKey: string, target: EventsObjectTarget, key: string, done: boolean): Promise<EventsWriteResult>
}
