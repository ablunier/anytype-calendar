import {
  listAll,
  type AnytypeClient,
  type AnytypeFilter,
  type AnytypeIssue,
  type AnytypeObjectRow,
  type AnytypePage,
  type AnytypePaging,
  type AnytypeResult
} from '@ablunier/anytype-client'
import type {
  EventsGateway,
  EventsGatewayResult,
  EventsObjectRef,
  EventsSource,
  EventsWindow
} from '../../domain'

const UNAUTHORIZED = 401

/**
 * A saved selection keeps a choice whose type, property or space is gone, or whose space this
 * key was never granted, to be matched by nothing until it returns; that is an answer of no
 * objects, not a failed span. Anytype refuses an unknown type key, or a filter or field over a
 * key the type does not have, with a 400; a space outside the grant with a 403; and a space
 * that is not open, or a query or view that is gone, with a 404.
 */
const GONE_STATUSES = new Set([400, 403, 404])

/**
 * Searches each type with date filters, asking only for the From and To values back, and the
 * Done, Location and colour-by values where the source names them. The
 * structured `filters` are used rather than the compact filter string, whose grammar has no
 * spelling for the keys Anytype mints for user properties (`6a650e02…`: they may start with a
 * digit). Like v1, a date filter rounds out to whole days (`greater_or_equal` to the start of
 * its day, `less_or_equal` to the end), so it can only return extra objects, never miss one —
 * which is what the port promises.
 *
 * A query is read through its view, which applies the view's own filters; the route takes no
 * others, so every object of the query comes back, whatever its dates.
 */
export class AnytypeV2EventsGateway implements EventsGateway {
  readonly #client: AnytypeClient
  readonly #warn: (message: string) => void
  /** Each told once: a query is read again on every load, and would repeat the same ones. */
  readonly #warned = new Set<string>()

  constructor({ client, warn = () => {} }: { client: AnytypeClient; warn?: (message: string) => void }) {
    this.#client = client
    this.#warn = warn
  }

  async listObjects(
    apiKey: string,
    source: EventsSource,
    window: EventsWindow
  ): Promise<EventsGatewayResult<EventsObjectRef[]>> {
    const api = this.#client.withApiKey(apiKey)
    if (source.kind === 'type') {
      const search = {
        type: source.typeKey,
        filters: windowFilters(source, window),
        fields: fieldsOf(source)
      }
      return this.#readAll(source, (paging) => api.search.inSpace(source.spaceId, search, paging))
    }
    const view = source.viewId === null ? {} : { view: source.viewId }
    return this.#readAll(source, (paging) =>
      api.queries.listObjects(source.spaceId, source.queryId, { ...view, fields: fieldsOf(source) }, paging)
    )
  }

  async #readAll(
    source: EventsSource,
    page: (paging: Required<AnytypePaging>) => Promise<AnytypeResult<AnytypePage<AnytypeObjectRow>>>
  ): Promise<EventsGatewayResult<EventsObjectRef[]>> {
    const response = await listAll(page)
    if (!response.ok) {
      if (response.status === UNAUTHORIZED) return { ok: false, failure: 'unauthorized' }
      if (!response.unsupported && GONE_STATUSES.has(response.status)) return { ok: true, value: [] }
      throw new Error(`Anytype answered ${response.status} when asked for objects`)
    }
    for (const { warnings } of response.body.pages) this.#report(source, warnings ?? [])
    return { ok: true, value: response.body.data.flatMap((row) => toRef(row, source)) }
  }

  /**
   * A query read with no view chosen is warned which one was applied; that is what was asked
   * for, so it is not repeated.
   */
  #report(source: EventsSource, warnings: readonly AnytypeIssue[]): void {
    for (const { path, message } of warnings) {
      if (source.kind === 'query' && source.viewId === null && path === 'view') continue
      if (this.#warned.has(message)) continue
      this.#warned.add(message)
      this.#warn(`Anytype warned when asked for objects: ${message}`)
    }
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
function windowFilters({ from, to }: EventsSource, window: EventsWindow): AnytypeFilter[] {
  // Unix seconds, rounded outward so the window only widens.
  const start = Math.floor(window.start / 1000)
  const end = Math.ceil(window.end / 1000)
  const notEmpty: AnytypeFilter = { property: from, condition: 'not_empty' }
  const fromBeforeEnd: AnytypeFilter = { property: from, condition: 'less_or_equal', value: end }
  const fromAfterStart: AnytypeFilter = { property: from, condition: 'greater_or_equal', value: start }
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
function toRef(row: AnytypeObjectRow, { from, to, done, location, colourBy }: EventsSource): EventsObjectRef[] {
  const { id, name, properties } = row
  if (typeof id !== 'string' || id === '') throw malformed()
  const start = dateIn(properties, from)
  if (start === null) return []
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
