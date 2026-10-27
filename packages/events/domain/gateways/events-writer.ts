export interface EventsObjectTarget {
  spaceId: string
  /** Anytype's object id. */
  id: string
}

export interface EventsCollectionTarget {
  spaceId: string
  /** Anytype's object id of the collection. */
  collectionId: string
}

/** Epoch milliseconds by date property key. */
export type EventsDateValues = Record<string, number>

/** As EventsDateValues, where null clears the date. */
export type EventsDateChanges = Record<string, number | null>

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
  /** Sets each date to its instant, or clears it; dates not named keep theirs. */
  reschedule(apiKey: string, target: EventsObjectTarget, dates: EventsDateChanges): Promise<EventsWriteResult>
  create(apiKey: string, object: EventsNewObject): Promise<EventsWriteResult<{ id: string }>>
  /** `objectId` is in the collection's space. One already in the collection is left as is. */
  addToCollection(apiKey: string, collection: EventsCollectionTarget, objectId: string): Promise<EventsWriteResult>
  /** `key` is the object's Done checkbox. */
  setDone(apiKey: string, target: EventsObjectTarget, key: string, done: boolean): Promise<EventsWriteResult>
}
