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
