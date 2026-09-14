/** A type put on the calendar, with the date properties (keys) that place its objects. */
export interface EventsSource {
  spaceId: string
  typeKey: string
  from: string
  /** Null places each object on its From date alone. */
  to: string | null
  /** Whether From/To carry a time of day, as the user stated when choosing the type. */
  includesTime: boolean
}
