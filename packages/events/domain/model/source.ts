/** Which pick a source is: a type, or a query over one. */
export type EventsSourceKey = { kind: 'type'; typeKey: string } | { kind: 'query'; queryId: string }

/**
 * A type put on the calendar, or a query read through one of its views, with the properties
 * (keys) that place and describe its objects. A query's are those of the type it runs over.
 */
export type EventsSource = EventsTypeSource | EventsQuerySource

export interface EventsTypeSource extends EventsSourceFields {
  kind: 'type'
  typeKey: string
}

export interface EventsQuerySource extends EventsSourceFields {
  kind: 'query'
  queryId: string
  /** Null reads the query's first view. */
  viewId: string | null
}

interface EventsSourceFields {
  spaceId: string
  from: string
  /** Null places each object on its From date alone. */
  to: string | null
  /** Whether From/To carry a time of day, as the user stated when choosing the source. */
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

export function eventsSourceKey(source: EventsSource): EventsSourceKey {
  return source.kind === 'type'
    ? { kind: 'type', typeKey: source.typeKey }
    : { kind: 'query', queryId: source.queryId }
}
