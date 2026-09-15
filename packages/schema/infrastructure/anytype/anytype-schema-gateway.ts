import type { AnytypeClient, AnytypeResponse } from '@anytype-calendar/anytype-client/infrastructure'
import type {
  SchemaGateway,
  SchemaGatewayResult,
  SchemaProperty,
  SchemaSpaceRef,
  SchemaTypeIcon,
  SchemaTypeRef
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

  async listTypes(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaTypeRef[]>> {
    const path = `/v1/spaces/${encodeURIComponent(spaceId)}/types`
    const result = await this.#listAll(apiKey, path, 'types')
    if (!result.ok) return result
    const types = result.value.flatMap((item) => {
      const key = stringField(item, 'key')
      const properties = field(item, 'properties')
      if (key === undefined || !Array.isArray(properties)) throw malformed('types')
      if (field(item, 'archived') === true) return []
      return [
        {
          key,
          name: stringField(item, 'name') ?? '',
          icon: toIcon(field(item, 'icon')),
          properties: properties.map(toProperty)
        }
      ]
    })
    return { ok: true, value: types }
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

function toProperty(item: unknown): SchemaProperty {
  const key = stringField(item, 'key')
  const format = stringField(item, 'format')
  if (key === undefined || format === undefined) throw malformed('types')
  return { key, name: stringField(item, 'name') ?? '', format }
}

/** Anytype also draws types with an emoji or an image; only a named icon is carried. */
function toIcon(icon: unknown): SchemaTypeIcon | null {
  const name = stringField(icon, 'name')
  const color = stringField(icon, 'color')
  return field(icon, 'format') === 'icon' && name !== undefined && color !== undefined
    ? { name, color }
    : null
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

function malformed(what: string): Error {
  return new Error(`Anytype answered without usable ${what}`)
}
