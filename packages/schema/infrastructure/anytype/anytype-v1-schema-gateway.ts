import type { AnytypeFailure } from '@ablunier/anytype-client'
import { listAllV1, type AnytypeV1Client } from '@anytype-calendar/anytype-v1/infrastructure'
import type {
  SchemaGateway,
  SchemaGatewayResult,
  SchemaProperty,
  SchemaQueryRef,
  SchemaSelectOption,
  SchemaSpaceList,
  SchemaTypeIcon,
  SchemaTypeRef
} from '../../domain'

/**
 * `anytype.onetoone` (a direct chat) and `anytype.techspace` (Anytype's own bookkeeping)
 * hold nothing the user would put on a calendar.
 */
const OBJECT_SPACE_KINDS = new Set(['anytype.space', 'anytype.chatspace'])

const UNAUTHORIZED = 401

export class AnytypeV1SchemaGateway implements SchemaGateway {
  readonly #client: AnytypeV1Client

  constructor(client: AnytypeV1Client) {
    this.#client = client
  }

  async listSpaces(apiKey: string): Promise<SchemaGatewayResult<SchemaSpaceList>> {
    const result = await this.#listAll((paging) => this.#client.spaces.list(apiKey, paging), 'spaces')
    if (!result.ok) return result
    const spaces = result.value.flatMap((item) => {
      const kind = stringField(item, 'object')
      const id = stringField(item, 'id')
      if (id === undefined || kind === undefined) throw malformed('spaces')
      return OBJECT_SPACE_KINDS.has(kind) ? [{ id, name: stringField(item, 'name') ?? '' }] : []
    })
    return { ok: true, value: { spaces, hasNotGrantedSpaces: false } }
  }

  async listTypes(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaTypeRef[]>> {
    const result = await this.#listAll((paging) => this.#client.types.list(apiKey, spaceId, paging), 'types')
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

  /** v1 serves options only as tags of a property, so select colours are left to v2. */
  async listSelectOptions(): Promise<SchemaGatewayResult<SchemaSelectOption[]>> {
    return { ok: true, value: [] }
  }

  /** v1 serves no route that reads a query through its views. */
  async listQueries(): Promise<SchemaGatewayResult<SchemaQueryRef[]>> {
    return { ok: true, value: [] }
  }

  async #listAll(
    page: Parameters<typeof listAllV1>[0],
    what: string
  ): Promise<SchemaGatewayResult<unknown[]>> {
    const response = await listAllV1(page)
    return response.ok ? { ok: true, value: response.body } : refused(response, what)
  }
}

function refused(
  response: AnytypeFailure,
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
