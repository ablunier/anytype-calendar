/** A type put on the calendar, with the properties (keys) that place and describe its objects. */
export interface EventsSource {
  spaceId: string
  typeKey: string
  from: string
  /** Null places each object on its From date alone. */
  to: string | null
  /** Whether From/To carry a time of day, as the user stated when choosing the type. */
  includesTime: boolean
  /** Its Done checkbox, where it has one. */
  done?: string
  /** Its Location text, where it has one. */
  location?: string
  /** A select property whose options colour its objects, as the user chose. */
  colourBy?: EventsColourBy
}

export interface EventsColourBy {
  key: string
  /** `color` is Anytype's own colour name. */
  options: { name: string; color: string }[]
}
