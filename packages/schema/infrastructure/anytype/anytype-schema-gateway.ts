import type { AnytypeClient, AnytypeResponse } from '@anytype-calendar/anytype-client/infrastructure'
import type {
  SchemaGateway,
  SchemaGatewayResult,
  SchemaProperty,
  SchemaSpaceRef
} from '../../domain'

/** The largest page the local API serves. */
const PAGE_LIMIT = 1_000

/**
 * `anytype.onetoone` (a direct chat) and `anytype.techspace` (Anytype's own bookkeeping)
 * hold nothing the user would put on a calendar.
 */
const OBJECT_SPACE_KINDS = new Set(['anytype.space', 'anytype.chatspace'])

const UNAUTHORIZED = 401

type Page = { data: unknown[]; hasMore: boolean }

export class AnytypeSchemaGateway implements SchemaGateway {
  readonly #client: AnytypeClient

  constructor(client: AnytypeClient) {
    this.#client = client
  }

  async listSpaces(apiKey: string): Promise<SchemaGatewayResult<SchemaSpaceRef[]>> {
    const result = await this.#listAll(apiKey, '/v1/spaces', 'spaces')
    if (!result.ok) return result
    const spaces = result.value.flatMap((item) => {
      const kind = stringField(item, 'object')
      const id = stringField(item, 'id')
      if (id === undefined || kind === undefined) throw malformed('spaces')
      return OBJECT_SPACE_KINDS.has(kind) ? [{ id, name: stringField(item, 'name') ?? '' }] : []
    })
    return { ok: true, value: spaces }
  }

  async listProperties(
    apiKey: string,
    spaceId: string
  ): Promise<SchemaGatewayResult<SchemaProperty[]>> {
    const path = `/v1/spaces/${encodeURIComponent(spaceId)}/properties`
    const result = await this.#listAll(apiKey, path, 'properties')
    if (!result.ok) return result
    const properties = result.value.map((item) => {
      const key = stringField(item, 'key')
      const format = stringField(item, 'format')
      if (key === undefined || format === undefined) throw malformed('properties')
      return { key, name: stringField(item, 'name') ?? '', format }
    })
    return { ok: true, value: properties }
  }

  async countObjectsWithAnyValue(
    apiKey: string,
    spaceId: string,
    propertyKeys: readonly string[]
  ): Promise<SchemaGatewayResult<number>> {
    // Only the total is read, so one result is enough to get it.
    const response = await this.#client.request({
      method: 'POST',
      path: `/v1/spaces/${encodeURIComponent(spaceId)}/search?offset=0&limit=1`,
      apiKey,
      body: {
        filters: {
          operator: 'or',
          conditions: propertyKeys.map((key) => ({ property_key: key, condition: 'nempty' }))
        }
      }
    })
    if (!response.ok) return refused(response, 'search')
    const total = numberField(field(response.body, 'pagination'), 'total')
    if (total === undefined) throw malformed('search')
    return { ok: true, value: total }
  }

  async #listAll(
    apiKey: string,
    path: string,
    what: string
  ): Promise<SchemaGatewayResult<unknown[]>> {
    const items: unknown[] = []
    for (;;) {
      const response = await this.#client.request({
        method: 'GET',
        path: `${path}?offset=${items.length}&limit=${PAGE_LIMIT}`,
        apiKey
      })
      if (!response.ok) return refused(response, what)
      const page = toPage(response.body)
      if (!page) throw malformed(what)
      items.push(...page.data)
      // An empty page that claims more would otherwise be asked for forever.
      if (!page.hasMore || page.data.length === 0) return { ok: true, value: items }
    }
  }
}

function refused(
  response: Extract<AnytypeResponse, { ok: false }>,
  what: string
): { ok: false; failure: 'unauthorized' } {
  if (response.status === UNAUTHORIZED) return { ok: false, failure: 'unauthorized' }
  throw new Error(`Anytype answered ${response.status} when asked for ${what}`)
}

function toPage(body: unknown): Page | null {
  const data = field(body, 'data')
  const hasMore = field(field(body, 'pagination'), 'has_more')
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

function numberField(value: unknown, name: string): number | undefined {
  const found = field(value, name)
  return typeof found === 'number' && Number.isInteger(found) && found >= 0 ? found : undefined
}

function malformed(what: string): Error {
  return new Error(`Anytype answered without usable ${what}`)
}
