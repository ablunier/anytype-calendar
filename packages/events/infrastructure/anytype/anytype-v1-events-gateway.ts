import { listAllV1, type AnytypeV1Client } from '@anytype-calendar/anytype-v1/infrastructure'
import type {
  EventsGateway,
  EventsGatewayResult,
  EventsObjectRef,
  EventsSource,
  EventsWindow
} from '../../domain'

const BAD_REQUEST = 400
const UNAUTHORIZED = 401

/**
 * Searches each type with date filters. The local API rounds a date filter out to whole days
 * (`gte` to the start of its day, `lte` to the end), so these can only return extra objects,
 * never miss one — which is what the port promises.
 */
export class AnytypeV1EventsGateway implements EventsGateway {
  readonly #client: AnytypeV1Client

  constructor(client: AnytypeV1Client) {
    this.#client = client
  }

  async listObjects(
    apiKey: string,
    source: EventsSource,
    window: EventsWindow
  ): Promise<EventsGatewayResult<EventsObjectRef[]>> {
    // v1 serves no route that reads a query through its views.
    if (source.kind === 'query') return { ok: true, value: [] }
    const body = { types: [source.typeKey], filters: windowFilter(source, window) }
    const response = await listAllV1((paging) =>
      this.#client.search.inSpace(apiKey, source.spaceId, body, paging)
    )
    if (!response.ok) {
      if (response.status === UNAUTHORIZED) return { ok: false, failure: 'unauthorized' }
      // Anytype refuses to build a filter over a property key the space does not have. A
      // saved selection keeps a choice whose property is gone, to be matched by nothing
      // until it returns, so that is an answer of no objects, not a failed month.
      if (response.status === BAD_REQUEST) return { ok: true, value: [] }
      throw new Error(`Anytype answered ${response.status} when searched for objects`)
    }
    return { ok: true, value: response.body.flatMap((item) => toRef(item, source)) }
  }
}

/**
 * A single date needs its From inside the window. A range needs its From at or before the
 * window's end, and either its To or its From at or after the window's start: the From
 * alternative catches an object with no To, and one whose To precedes its From, which the
 * domain places on its From alone. `lte` also matches an empty date, hence the `nempty`.
 */
function windowFilter({ from, to }: EventsSource, window: EventsWindow): unknown {
  const start = new Date(window.start).toISOString()
  const end = new Date(window.end).toISOString()
  if (to === null) {
    return {
      operator: 'and',
      conditions: [
        { property_key: from, condition: 'gte', date: start },
        { property_key: from, condition: 'lte', date: end }
      ]
    }
  }
  return {
    operator: 'and',
    conditions: [
      { property_key: from, condition: 'nempty' },
      { property_key: from, condition: 'lte', date: end }
    ],
    filters: [
      {
        operator: 'or',
        conditions: [
          { property_key: to, condition: 'gte', date: start },
          { property_key: from, condition: 'gte', date: start }
        ]
      }
    ]
  }
}

/** Anytype leaves a property the object has no value for out of `properties` altogether. */
function toRef(item: unknown, { from, to }: EventsSource): EventsObjectRef[] {
  const id = stringField(item, 'id')
  const properties = field(item, 'properties')
  if (id === undefined || !Array.isArray(properties)) throw malformed()
  if (field(item, 'archived') === true) return []
  const start = dateIn(properties, from)
  if (start === null) return []
  return [
    {
      id,
      title: typeof field(item, 'name') === 'string' ? (field(item, 'name') as string) : '',
      start,
      end: to === null ? null : dateIn(properties, to)
    }
  ]
}

/** Epoch milliseconds. Anytype answers dates as RFC 3339 in UTC, e.g. `2026-09-13T22:00:00Z`. */
function dateIn(properties: unknown[], key: string): number | null {
  const property = properties.find((candidate) => field(candidate, 'key') === key)
  if (property === undefined) return null
  const value = field(property, 'date')
  const instant = typeof value === 'string' ? Date.parse(value) : NaN
  if (Number.isNaN(instant)) throw malformed()
  return instant
}

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[name]
    : undefined
}

function stringField(value: unknown, name: string): string | undefined {
  const found = field(value, name)
  return typeof found === 'string' && found !== '' ? found : undefined
}

function malformed(): Error {
  return new Error('Anytype answered without usable objects')
}
