import {
  ANYTYPE_PAGE_LIMIT,
  listAll,
  type AnytypeApi,
  type AnytypeClient,
  type AnytypeFailure,
  type AnytypeIcon,
  type AnytypePage,
  type AnytypePaging,
  type AnytypePropertyDefinition,
  type AnytypeResult,
  type AnytypeTypeDocument
} from '@ablunier/anytype-client'
import type { AnytypeV1Client } from '@anytype-calendar/anytype-v1/infrastructure'
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

/** A type list row carries no properties, so each type is read on its own, this many at once. */
const TYPE_READS_AT_ONCE = 4

/** Anytype's own type of queries, which it still calls `set` internally. */
const QUERY_TYPE_KEY = 'query'

/** Pixels. A space's image is drawn at 16, so this covers a 4x display. */
const SPACE_ICON_WIDTH = 64

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

const BAD_REQUEST = 400
const UNAUTHORIZED = 401
/** `space_not_granted`: the user took the space out of the key's grant since it was listed. */
const FORBIDDEN = 403
const NOT_FOUND = 404

type Listing<Page extends AnytypePage<unknown>> = { items: Page['data']; pages: Page[] }

/**
 * v2 lists only the spaces the key was granted, and never Anytype's tech space, but says
 * whether the grant leaves others out. Unlike v1 it does not say what kind of space each is,
 * so it cannot leave out one-to-one chats; those hold no dated types, so they show as spaces
 * with nothing to put on the calendar.
 */
export class AnytypeV2SchemaGateway implements SchemaGateway {
  readonly #client: AnytypeClient
  readonly #v1: AnytypeV1Client
  readonly #encodeBase64: (bytes: Uint8Array) => string
  /**
   * `data:` URLs by file id. A space's image is stored under a new id when it changes, so an
   * id's image never goes stale, and every sync need not download it again.
   */
  readonly #icons = new Map<string, string>()

  /** `v1` reads the keys v1 served date properties by, to rewrite a selection saved under v1. */
  constructor({
    client,
    v1,
    encodeBase64
  }: {
    client: AnytypeClient
    v1: AnytypeV1Client
    encodeBase64: (bytes: Uint8Array) => string
  }) {
    this.#client = client
    this.#v1 = v1
    this.#encodeBase64 = encodeBase64
  }

  async listSpaces(apiKey: string): Promise<SchemaGatewayResult<SchemaSpaceList>> {
    // The client asks for full ids, which is what the saved selection stores.
    const api = this.#client.withApiKey(apiKey)
    const result = await this.#listAll((paging) => api.spaces.list(paging), 'spaces')
    if (!result.ok) return result
    const spaces = await Promise.all(
      result.value.items.map(async (item) => {
        const id = nonEmpty(item.id)
        if (id === undefined) throw malformed('spaces')
        const space = { id, name: nonEmpty(item.name) ?? '' }
        const fileId = nonEmpty(item.icon_image)
        const icon = fileId === undefined ? undefined : await this.#spaceIcon(api, id, fileId)
        return icon === undefined ? space : { ...space, icon }
      })
    )
    const hasNotGrantedSpaces = result.value.pages.some((page) => page.has_not_granted_spaces === true)
    return { ok: true, value: { spaces, hasNotGrantedSpaces } }
  }

  async listSelectOptions(
    apiKey: string,
    spaceId: string,
    propertyKey: string
  ): Promise<SchemaGatewayResult<SchemaSelectOption[]>> {
    const api = this.#client.withApiKey(apiKey)
    const result = await this.#listAll((paging) => api.properties.listOptions(spaceId, propertyKey, paging), 'options')
    if (!result.ok) return result
    return {
      ok: true,
      value: result.value.items.flatMap((item) => {
        const name = nonEmpty(item.name)
        const color = nonEmpty(item.color)
        return name !== undefined && color !== undefined ? [{ name, color }] : []
      })
    }
  }

  /** Decoration only: an image that cannot be read leaves the space drawn by its initial. */
  async #spaceIcon(api: AnytypeApi, spaceId: string, fileId: string): Promise<string | undefined> {
    const cached = this.#icons.get(fileId)
    if (cached !== undefined) return cached
    try {
      const response = await api.files.content(spaceId, fileId, { width: SPACE_ICON_WIDTH })
      const mediaType = response.ok ? response.body.contentType?.split(';')[0]?.trim() : undefined
      if (!response.ok || !mediaType?.startsWith('image/')) return undefined
      const icon = `data:${mediaType};base64,${this.#encodeBase64(response.body.bytes)}`
      this.#icons.set(fileId, icon)
      return icon
    } catch {
      return undefined
    }
  }

  async listTypes(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaTypeRef[]>> {
    const api = this.#client.withApiKey(apiKey)
    const listed = await this.#listAll((paging) => api.types.list(spaceId, paging), 'types')
    if (!listed.ok) return listed
    const keys = listed.value.items.map((item) => {
      const key = nonEmpty(item.key)
      if (key === undefined) throw malformed('types')
      return key
    })

    const types: (ReadType | null)[] = []
    let refused = false
    await eachAtMost(TYPE_READS_AT_ONCE, keys, async (key, index) => {
      const response = await api.types.get(spaceId, key)
      if (response.ok) {
        types[index] = toType(key, response.body)
        return
      }
      if (response.status === UNAUTHORIZED) {
        refused = true
        return
      }
      if (isGone(response)) {
        types[index] = null
        return
      }
      throw unexpected(response, 'a type')
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
    const response = await this.#v1.types.list(apiKey, spaceId, { offset: 0, limit: ANYTYPE_PAGE_LIMIT })
    const data = response.ok ? response.body?.data : undefined
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

  /**
   * A search row names no query's type, so each query's document is read for it, along with
   * its views, a few queries at a time.
   */
  async listQueries(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaQueryRef[]>> {
    const api = this.#client.withApiKey(apiKey)
    const search = { type: QUERY_TYPE_KEY }
    const listed = await this.#listAll((paging) => api.search.inSpace(spaceId, search, paging), 'queries')
    if (!listed.ok) return listed
    const rows = listed.value.items.map((item) => {
      const id = nonEmpty(item.id)
      if (id === undefined) throw malformed('queries')
      return { id, name: nonEmpty(item.name) ?? '' }
    })

    const queries: (SchemaQueryRef | null)[] = []
    let refused = false
    await eachAtMost(TYPE_READS_AT_ONCE, rows, async ({ id, name }, index) => {
      const document = await api.objects.get(spaceId, id, { include: 'properties' })
      if (!document.ok) {
        if (document.status === UNAUTHORIZED) refused = true
        else if (!isGone(document)) throw unexpected(document, 'a query')
        queries[index] = null
        return
      }
      const listed = await this.#listAll((paging) => api.queries.listViews(spaceId, id, paging), 'views')
      if (!listed.ok) {
        refused = true
        return
      }
      const views = listed.value.items.flatMap((item) => {
        const viewId = nonEmpty(item.id)
        return viewId === undefined ? [] : [{ id: viewId, name: nonEmpty(item.name) ?? '' }]
      })
      // Anytype refuses to delete a query's last view, so a query with none is itself gone.
      queries[index] = views.length === 0 ? null : { id, name, typeKeys: toQueryTypeKeys(document.body), views }
    })
    if (refused) return { ok: false, failure: 'unauthorized' }
    return { ok: true, value: queries.filter((query) => query != null) }
  }

  async #listAll<Page extends AnytypePage<unknown>>(
    page: (paging: Required<AnytypePaging>) => Promise<AnytypeResult<Page>>,
    what: string
  ): Promise<SchemaGatewayResult<Listing<Page>>> {
    const response = await listAll(page)
    if (response.ok) return { ok: true, value: { items: response.body.data, pages: response.body.pages } }
    if (response.status === UNAUTHORIZED) return { ok: false, failure: 'unauthorized' }
    // A space taken out of the grant holds nothing; so does a property deleted since its type
    // was read, for which the options route answers 404 or 400, and a query deleted since it
    // was listed, whose views route answers 404.
    if (
      response.status === FORBIDDEN ||
      (what === 'options' && response.status === BAD_REQUEST) ||
      ((what === 'options' || what === 'views') && isGone(response))
    ) {
      return { ok: true, value: { items: [], pages: [] } }
    }
    throw unexpected(response, what)
  }
}

function unexpected(response: AnytypeFailure, what: string): Error {
  return new Error(`Anytype answered ${response.status} when asked for ${what}`)
}

/**
 * Deleted, or its space taken out of the grant, between being listed and being read: it is
 * simply not there any more. A bare 404 is not that but a build without the route.
 */
function isGone(response: AnytypeFailure): boolean {
  return response.status === FORBIDDEN || (response.status === NOT_FOUND && !response.unsupported)
}

/**
 * A query's document names what it runs over in `query_source`, e.g. `{ types: ["task"] }`.
 * Anytype's app can also build a query over a property rather than a type; that is read as
 * running over no type.
 */
function toQueryTypeKeys(document: { query_source?: { types?: unknown } } | null): string[] {
  const types = document?.query_source?.types
  return Array.isArray(types) ? types.filter((key): key is string => typeof key === 'string' && key !== '') : []
}

/**
 * `v1Key` is the key v1 serves the type by. `unsure` are its date properties v2 serves by their
 * internal key, as it does when their v1 key collides with a property Anytype bundles: v1
 * spelled those another way, which only v1 can tell.
 */
type ReadType = { type: SchemaTypeRef; v1Key: string; unsure: string[] }

/** A type document (`kind: object_type`): its icon at the top, its properties in its settings. */
function toType(key: string, document: AnytypeTypeDocument | null): ReadType {
  const settings = document?.type_settings
  const definitions = settings?.property_definitions
  if (!Array.isArray(definitions)) throw malformed('types')
  const v1Key = nonEmpty(settings?.api_key) ?? key
  const type: SchemaTypeRef = {
    key,
    name: nonEmpty(document?.properties?.name) ?? '',
    icon: toIcon(document?.icon),
    properties: definitions.map(toProperty)
  }
  const unsure = definitions.flatMap((item) => {
    const property = nonEmpty(item?.property)
    return property !== undefined &&
      property === nonEmpty(item.internal_key) &&
      item.format === 'date' &&
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

function toProperty(item: AnytypePropertyDefinition | null): SchemaProperty {
  const key = nonEmpty(item?.property)
  const format = nonEmpty(item?.format)
  if (key === undefined || format === undefined) throw malformed('types')
  return { key: SYSTEM_KEY_SPELLINGS[key] ?? key, name: nonEmpty(item?.name) ?? '', format }
}

/** Anytype also draws types with an emoji or an image; only a named icon is carried. */
function toIcon(icon: AnytypeIcon | null | undefined): SchemaTypeIcon | null {
  if (icon?.format !== 'icon') return null
  const name = nonEmpty(icon.name)
  const color = nonEmpty(icon.color)
  return name !== undefined && color !== undefined ? { name, color } : null
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

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[name]
    : undefined
}

function stringField(value: unknown, name: string): string | undefined {
  return nonEmpty(field(value, name))
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function malformed(what: string): Error {
  return new Error(`Anytype answered without usable ${what}`)
}
