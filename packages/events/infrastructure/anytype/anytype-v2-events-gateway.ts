import {
  isUnmatchedRoute,
  type AnytypeClient,
  type AnytypeDialectProbe
} from '@anytype-calendar/anytype-client/infrastructure'
import type {
  EventsGateway,
  EventsGatewayResult,
  EventsObjectRef,
  EventsSource,
  EventsWindow
} from '../../domain'

/** The largest page the local API serves. */
const PAGE_LIMIT = 1_000

const UNAUTHORIZED = 401

/**
 * A saved selection keeps a choice whose type, property or space is gone, or whose space this
 * key was never granted, to be matched by nothing until it returns; that is an answer of no
 * objects, not a failed span. Anytype refuses an unknown type key, or a filter or field over a
 * key the type does not have, with a 400; a space outside the grant with a 403; and a space
 * that is not open with a 404.
 */
const GONE_STATUSES = new Set([400, 403, 404])

type Page = { data: unknown[]; hasMore: boolean }

/**
 * Searches each type with date filters, asking only for the From and To values back, and the
 * Done, Location and colour-by values where the source names them. The
 * structured `filters` are used rather than the compact filter string, whose grammar has no
 * spelling for the keys Anytype mints for user properties (`6a650e02…`: they may start with a
 * digit). Like v1, a date filter rounds out to whole days (`greater_or_equal` to the start of
 * its day, `less_or_equal` to the end), so it can only return extra objects, never miss one —
 * which is what the port promises.
 */
export class AnytypeV2EventsGateway implements EventsGateway {
  readonly #client: AnytypeClient
  readonly #probe: AnytypeDialectProbe

  constructor({ client, probe }: { client: AnytypeClient; probe: AnytypeDialectProbe }) {
    this.#client = client
    this.#probe = probe
  }

  async listObjects(
    apiKey: string,
    source: EventsSource,
    window: EventsWindow
  ): Promise<EventsGatewayResult<EventsObjectRef[]>> {
    const path = `/v2/spaces/${encodeURIComponent(source.spaceId)}/search`
    const body = {
      type: source.typeKey,
      filters: windowFilters(source, window),
      fields: fieldsOf(source)
    }
    const items: unknown[] = []
    for (;;) {
      const response = await this.#client.request({
        method: 'POST',
        path: `${path}?offset=${items.length}&limit=${PAGE_LIMIT}`,
        apiKey,
        body
      })
      if (!response.ok) {
        if (response.status === UNAUTHORIZED) return { ok: false, failure: 'unauthorized' }
        if (isUnmatchedRoute(response)) {
          this.#probe.forget()
        } else if (GONE_STATUSES.has(response.status)) {
          return { ok: true, value: [] }
        }
        throw new Error(`Anytype answered ${response.status} when searched for objects`)
      }
      const page = toPage(response.body)
      if (!page) throw malformed()
      items.push(...page.data)
      // An empty page that claims more would otherwise be asked for forever.
      if (!page.hasMore || page.data.length === 0) break
    }
    return { ok: true, value: items.flatMap((item) => toRef(item, source)) }
  }
}

/** Only keys the type has: v2 refuses a field the type lacks as a bad request. */
function fieldsOf({ from, to, done, location, colourBy }: EventsSource): string[] {
  return [from, to, done, location, colourBy?.key].filter((key) => key != null)
}

/**
 * A single date needs its From inside the window. A range needs its From at or before the
 * window's end, and either its To or its From at or after the window's start: the From
 * alternative catches an object with no To, and one whose To precedes its From, which the
 * domain places on its From alone. `less_or_equal` also matches an empty date, hence
 * `not_empty`. Top-level leaves combine with an implicit AND.
 */
function windowFilters({ from, to }: EventsSource, window: EventsWindow): unknown[] {
  // Unix seconds, rounded outward so the window only widens.
  const start = Math.floor(window.start / 1000)
  const end = Math.ceil(window.end / 1000)
  const notEmpty = { property: from, condition: 'not_empty' }
  const fromBeforeEnd = { property: from, condition: 'less_or_equal', value: end }
  const fromAfterStart = { property: from, condition: 'greater_or_equal', value: start }
  if (to === null) return [notEmpty, fromAfterStart, fromBeforeEnd]
  return [
    notEmpty,
    fromBeforeEnd,
    {
      operator: 'or',
      filters: [{ property: to, condition: 'greater_or_equal', value: start }, fromAfterStart]
    }
  ]
}

/**
 * A row carries only the fields asked for, and leaves out any the object has no value for: an
 * unticked Done among them.
 */
function toRef(item: unknown, { from, to, done, location, colourBy }: EventsSource): EventsObjectRef[] {
  const id = stringField(item, 'id')
  const properties = field(item, 'properties')
  if (id === undefined) throw malformed()
  const start = dateIn(properties, from)
  if (start === null) return []
  const name = field(item, 'name')
  const ref: EventsObjectRef = {
    id,
    title: typeof name === 'string' ? name : '',
    start,
    end: to === null ? null : dateIn(properties, to)
  }
  if (done !== undefined) ref.done = field(properties, done) === true
  const place = location === undefined ? undefined : stringField(properties, location)
  if (place !== undefined) ref.location = place
  const option = colourBy === undefined ? undefined : optionIn(properties, colourBy.key)
  if (option !== undefined) ref.option = option
  return [ref]
}

/** A select's value is the list of its picked options' names, e.g. `["P4"]`. */
function optionIn(properties: unknown, key: string): string | undefined {
  const value = field(properties, key)
  const first: unknown = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first !== '' ? first : undefined
}

/** Epoch milliseconds. v2 serves a date as a bare RFC 3339 string in UTC, e.g. `2026-09-13T22:00:00Z`. */
function dateIn(properties: unknown, key: string): number | null {
  const value = field(properties, key)
  if (value === undefined || value === null || value === '') return null
  const instant = typeof value === 'string' ? Date.parse(value) : NaN
  if (Number.isNaN(instant)) throw malformed()
  return instant
}

function toPage(body: unknown): Page | null {
  const data = field(body, 'data')
  const hasMore = field(body, 'has_more')
  if (!Array.isArray(data) || typeof hasMore !== 'boolean') return null
  return { data, hasMore }
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
