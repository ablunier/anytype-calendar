import type { EventsSource } from '../model/source'

/**
 * Which types go on the calendar is owned by the schema context; the composition root adapts
 * its saved selection to this port, so this context reads it without depending on schema.
 */
export interface EventsSourceSelection {
  /** Empty when nothing is selected. */
  current(): EventsSource[]
}
