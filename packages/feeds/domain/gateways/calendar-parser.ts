import type { FeedsOccurrence } from '../model/event'
import type { FeedsWindow } from '../model/window'

/** A feed read once, which can then be expanded over any window without being read again. */
export interface FeedsCalendar {
  /** The name the feed gives itself (`X-WR-CALNAME`), if any. */
  name: string | null
  /**
   * Every occurrence that overlaps the window, recurring events expanded into it. In no
   * particular order.
   */
  occurrencesIn(window: FeedsWindow): FeedsOccurrence[]
}

/** Behind a port so the iCalendar library can be swapped. */
export interface FeedsCalendarParser {
  /** Null when `text` is not an iCalendar feed. */
  parse(text: string): FeedsCalendar | null
}
