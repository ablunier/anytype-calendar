import {
  isUnmatchedRoute,
  type AnytypeClient,
  type AnytypeDialectProbe,
  type AnytypeResponse
} from '@anytype-calendar/anytype-client/infrastructure'
import type {
  SchemaGateway,
  SchemaGatewayResult,
  SchemaProperty,
  SchemaSpaceList,
  SchemaTypeIcon,
  SchemaTypeRef
} from '../../domain'

/** The largest page the local API serves. */
const PAGE_LIMIT = 1_000

/** A type list row carries no properties, so each type is read on its own, this many at once. */
const TYPE_READS_AT_ONCE = 4

/**
 * The type document spells some of Anytype's own property keys the way the app stores them
 * internally, not as the snake_case keys every other v2 route serves.
 */
const SYSTEM_KEY_SPELLINGS: Readonly<Record<string, string>> = {
  lastOpenedDate: 'last_opened_date',
  lastModifiedDate: 'last_modified_date',
  createdDate: 'created_date',
  addedDate: 'added_date',
  lastMessageDate: 'last_message_date'
}

const UNAUTHORIZED = 401
/** `space_not_granted`: the user took the space out of the key's grant since it was listed. */
const FORBIDDEN = 403
const NOT_FOUND = 404

type Page = { data: unknown[]; hasMore: boolean; hasNotGrantedSpaces: boolean }
type Listing = { items: unknown[]; hasNotGrantedSpaces: boolean }

/**
 * v2 lists only the spaces the key was granted, and never Anytype's tech space, but says
 * whether the grant leaves others out. Unlike v1 it does not say what kind of space each is,
 * so it cannot leave out one-to-one chats; those hold no dated types, so they show as spaces
 * with nothing to put on the calendar.
 */
export class AnytypeV2SchemaGateway implements SchemaGateway {
  readonly #client: AnytypeClient
  readonly #probe: AnytypeDialectProbe

  constructor({ client, probe }: { client: AnytypeClient; probe: AnytypeDialectProbe }) {
    this.#client = client
    this.#probe = probe
  }

  async listSpaces(apiKey: string): Promise<SchemaGatewayResult<SchemaSpaceList>> {
    // The full id is what the saved selection stores; the default short one can become
    // ambiguous when the account joins another space.
    const result = await this.#listAll(apiKey, '/v2/spaces', 'ids=full&', 'spaces')
    if (!result.ok) return result
    const spaces = result.value.items.map((item) => {
      const id = stringField(item, 'id')
      if (id === undefined) throw malformed('spaces')
      return { id, name: stringField(item, 'name') ?? '' }
    })
    return { ok: true, value: { spaces, hasNotGrantedSpaces: result.value.hasNotGrantedSpaces } }
  }

  async listTypes(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaTypeRef[]>> {
    const space = `/v2/spaces/${encodeURIComponent(spaceId)}`
    const listed = await this.#listAll(apiKey, `${space}/types`, '', 'types')
    if (!listed.ok) return listed
    const keys = listed.value.items.map((item) => {
      const key = stringField(item, 'key')
      if (key === undefined) throw malformed('types')
      return key
    })

    const types: (ReadType | null)[] = []
    let refused = false
    await eachAtMost(TYPE_READS_AT_ONCE, keys, async (key, index) => {
      const response = await this.#client.request({
        method: 'GET',
        path: `${space}/types/${encodeURIComponent(key)}`,
        apiKey
      })
      if (response.ok) {
        types[index] = toType(key, response.body)
        return
      }
      if (response.status === UNAUTHORIZED) {
        refused = true
        return
      }
      // Deleted, or its space taken out of the grant, between the list and this read: it is
      // simply not there any more.
      if (
        response.status === FORBIDDEN ||
        (response.status === NOT_FOUND && !isUnmatchedRoute(response))
      ) {
        types[index] = null
        return
      }
      throw this.#unexpected(response, 'a type')
    })
    if (refused) return { ok: false, failure: 'unauthorized' }
    const read = types.filter((type) => type != null)
    const formerKeys = read.some(({ unsure }) => unsure.length > 0)
      ? await this.#v1DatePropertyKeys(apiKey, spaceId)
      : new Map<string, SchemaProperty[]>()
    return { ok: true, value: read.map((type) => withFormerPropertyKeys(type, formerKeys)) }
  }

  /**
   * v1's date property keys of each type in the space, by the type's v1 key. Every Anytype
   * that serves v2 serves v1 too; should that stop, the old spellings are simply not known.
   */
  async #v1DatePropertyKeys(apiKey: string, spaceId: string): Promise<Map<string, SchemaProperty[]>> {
    const response = await this.#client.request({
      method: 'GET',
      path: `/v1/spaces/${encodeURIComponent(spaceId)}/types?offset=0&limit=${PAGE_LIMIT}`,
      apiKey
    })
    const data = response.ok ? field(response.body, 'data') : undefined
    const byType = new Map<string, SchemaProperty[]>()
    for (const item of Array.isArray(data) ? data : []) {
      const key = stringField(item, 'key')
      const properties = field(item, 'properties')
      if (key === undefined || !Array.isArray(properties)) continue
      byType.set(
        key,
        properties.flatMap((property) => {
          const propertyKey = stringField(property, 'key')
          const format = stringField(property, 'format')
          return propertyKey !== undefined && format === 'date'
            ? [{ key: propertyKey, name: stringField(property, 'name') ?? '', format }]
            : []
        })
      )
    }
    return byType
  }

  async #listAll(
    apiKey: string,
    path: string,
    query: string,
    what: string
  ): Promise<SchemaGatewayResult<Listing>> {
    const items: unknown[] = []
    let hasNotGrantedSpaces = false
    for (;;) {
      const response = await this.#client.request({
        method: 'GET',
        path: `${path}?${query}offset=${items.length}&limit=${PAGE_LIMIT}`,
        apiKey
      })
      if (!response.ok) {
        if (response.status === UNAUTHORIZED) return { ok: false, failure: 'unauthorized' }
        if (response.status === FORBIDDEN) {
          return { ok: true, value: { items: [], hasNotGrantedSpaces } }
        }
        throw this.#unexpected(response, what)
      }
      const page = toPage(response.body)
      if (!page) throw malformed(what)
      items.push(...page.data)
      hasNotGrantedSpaces ||= page.hasNotGrantedSpaces
      // An empty page that claims more would otherwise be asked for forever.
      if (!page.hasMore || page.data.length === 0) {
        return { ok: true, value: { items, hasNotGrantedSpaces } }
      }
    }
  }

  #unexpected(response: Extract<AnytypeResponse, { ok: false }>, what: string): Error {
    if (isUnmatchedRoute(response)) this.#probe.forget()
    return new Error(`Anytype answered ${response.status} when asked for ${what}`)
  }
}

/**
 * `v1Key` is the key v1 serves the type by. `unsure` are its date properties v2 serves by their
 * internal key, as it does when their v1 key collides with a property Anytype bundles: v1
 * spelled those another way, which only v1 can tell.
 */
type ReadType = { type: SchemaTypeRef; v1Key: string; unsure: string[] }

/** A type document (`kind: object_type`): its icon at the top, its properties in its settings. */
function toType(key: string, document: unknown): ReadType {
  const settings = field(document, 'type_settings')
  const definitions = field(settings, 'property_definitions')
  if (!Array.isArray(definitions)) throw malformed('types')
  const v1Key = stringField(settings, 'api_key') ?? key
  const type: SchemaTypeRef = {
    key,
    name: stringField(field(document, 'properties'), 'name') ?? '',
    icon: toIcon(field(document, 'icon')),
    properties: definitions.map(toProperty)
  }
  const unsure = definitions.flatMap((item) => {
    const property = stringField(item, 'property')
    return property !== undefined &&
      property === stringField(item, 'internal_key') &&
      stringField(item, 'format') === 'date' &&
      SYSTEM_KEY_SPELLINGS[property] === undefined
      ? [property]
      : []
  })
  return { type: v1Key === key ? type : { ...type, formerKey: v1Key }, v1Key, unsure }
}

/** Matched by name among the type's date properties, and only where one alone has it. */
function withFormerPropertyKeys(
  { type, v1Key, unsure }: ReadType,
  v1Properties: Map<string, SchemaProperty[]>
): SchemaTypeRef {
  if (unsure.length === 0) return type
  const former = v1Properties.get(v1Key) ?? []
  return {
    ...type,
    properties: type.properties.map((property) => {
      if (!unsure.includes(property.key)) return property
      const matches = former.filter(({ name }) => name === property.name)
      const formerKey = matches.length === 1 ? matches[0]?.key : undefined
      return formerKey === undefined || formerKey === property.key ? property : { ...property, formerKey }
    })
  }
}

function toProperty(item: unknown): SchemaProperty {
  const key = stringField(item, 'property')
  const format = stringField(item, 'format')
  if (key === undefined || format === undefined) throw malformed('types')
  return { key: SYSTEM_KEY_SPELLINGS[key] ?? key, name: stringField(item, 'name') ?? '', format }
}

/** Anytype also draws types with an emoji or an image; only a named icon is carried. */
function toIcon(icon: unknown): SchemaTypeIcon | null {
  const name = stringField(icon, 'name')
  const color = stringField(icon, 'color')
  return field(icon, 'format') === 'icon' && name !== undefined && color !== undefined
    ? { name, color }
    : null
}

/** Runs `work` over `items` with at most `limit` in flight, keeping each result's index. */
async function eachAtMost<T>(
  limit: number,
  items: readonly T[],
  work: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++
      await work(items[index] as T, index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

function toPage(body: unknown): Page | null {
  const data = field(body, 'data')
  const hasMore = field(body, 'has_more')
  if (!Array.isArray(data) || typeof hasMore !== 'boolean') return null
  // Only the spaces list carries it.
  return { data, hasMore, hasNotGrantedSpaces: field(body, 'has_not_granted_spaces') === true }
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
