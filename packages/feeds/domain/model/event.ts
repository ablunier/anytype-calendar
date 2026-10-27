/** One occurrence of an event of a feed: a recurring event has one per time it recurs. */
export interface FeedsOccurrence {
  /** Unique within its feed: the event's UID, and for one of a recurring event's, when it recurs. */
  id: string
  title: string
  /** Epoch milliseconds. An all-day occurrence starts on the first instant of its first day. */
  start: number
  /**
   * Epoch milliseconds. For an all-day occurrence, the first instant of its last day, which
   * the feed's exclusive end is the day after; for a timed one, its end. Null for a single day,
   * or a moment.
   */
  end: number | null
  allDay: boolean
  location?: string
  /** Plain text, as the feed holds it. */
  description?: string
  /** The page the feed links the event to. */
  url?: string
}

export interface FeedsEvent extends FeedsOccurrence {
  /** The subscription it was read from. */
  feedId: string
  /** Where that subscription stands in the user's order. */
  rank: number
}

/** Earliest first; events starting together by their subscription's place, then title, then id. */
export function compareFeedsEvents(a: FeedsEvent, b: FeedsEvent): number {
  if (a.start !== b.start) return a.start - b.start
  if (a.rank !== b.rank) return a.rank - b.rank
  if (a.title !== b.title) return a.title < b.title ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
