// What Anytype's local API v2 serves, as it serves it: snake_case, unvalidated. Every member
// the API may leave out is optional, and the API is a pre-release, so check what you rely on.

/** Pagination a list route takes. `limit` is at most `ANYTYPE_PAGE_LIMIT`. */
export interface AnytypePaging {
  offset?: number
  limit?: number
}

/** What a read could not do as asked, beside its result, or why a request was refused. */
export interface AnytypeIssue {
  /** e.g. `ops[0].set.due_date`, or `view` when a query was read through its first view. */
  path?: string
  message: string
  hint?: string
}

export interface AnytypePage<Row> {
  data: Row[]
  has_more: boolean
  total?: number
  offset?: number
  limit?: number
  /** A hint for the next request, e.g. that more pages exist. */
  message?: string
  warnings?: AnytypeIssue[]
}

export type AnytypePermission = 'read' | 'readwrite'

/** Null for a key paired without a grant. `space_ids` are full ids. */
export type AnytypeApiKeyGrant = {
  all_spaces: boolean
  space_ids: string[]
  permission: AnytypePermission
} | null

export interface AnytypeChallenge {
  challenge_id: string
}

export interface AnytypeApiKey {
  /** `anytype_<body>_<checksum>`; keys issued before v2 are unprefixed base64. */
  api_key: string
  grant: AnytypeApiKeyGrant
}

/**
 * A legacy key (issued before grants) answers `scoped: false`, `permission: null` and
 * `key_status: 'legacy'`. An all-spaces grant lists every live space in `spaces` too, which is
 * not its boundary: `restricted` is.
 */
export interface AnytypeWhoami {
  api?: {
    /** Says `2025-11-08` even over v2. */
    version?: string
  }
  grant?: {
    scoped?: boolean
    restricted?: boolean
    all_spaces?: boolean
    permission?: AnytypePermission | null
    space_count?: number
    spaces?: { id?: string; name?: string; permission?: string }[]
  }
  key?: { id?: string; name?: string; created_at?: string; expires_at?: string }
  /** `scoped` or `legacy`. */
  key_status?: string
  notice?: string
}

export interface AnytypeSpaceRow {
  id?: string
  name?: string
  /** A file id: read it with `files.content`. */
  icon_image?: string
}

/**
 * Lists only the spaces the key was granted, never Anytype's tech space, and says nothing of a
 * space's kind.
 */
export interface AnytypeSpacePage extends AnytypePage<AnytypeSpaceRow> {
  /** Other live spaces exist that the key's grant leaves out. */
  has_not_granted_spaces: boolean
}

/** A type list row carries no icon or properties: read the type document for those. */
export interface AnytypeTypeRow {
  key?: string
  name?: string
}

export type AnytypeColor =
  | 'grey'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'pink'
  | 'purple'
  | 'blue'
  | 'ice'
  | 'teal'
  | 'lime'

export type AnytypeIcon =
  | { format: 'icon'; name?: string; color?: AnytypeColor }
  | { format: 'emoji'; emoji?: string }
  | { format: 'file'; file?: string }

export type AnytypePropertyFormat =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'files'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone'
  | 'objects'

export interface AnytypePropertyDefinition {
  /**
   * The key other routes serve the property by. For some of Anytype's own properties it is
   * spelled as Anytype stores it internally (`lastOpenedDate`), where every other route says
   * `last_opened_date`.
   */
  property?: string
  internal_key?: string
  name?: string
  format?: AnytypePropertyFormat | (string & {})
}

/** `GET …/types/{type}`, an AnyBlock document of kind `object_type`. */
export interface AnytypeTypeDocument {
  kind?: string
  icon?: AnytypeIcon
  properties?: { name?: string; description?: string | null }
  type_settings?: {
    /**
     * The key v1 serves the type by. v2 serves a user type whose name collides with one Anytype
     * bundles by its internal key instead.
     */
    api_key?: string
    layout?: string
    plural_name?: string
    property_definitions?: AnytypePropertyDefinition[]
  }
}

/** Options are space-wide and have no id: a row names the option it holds by name. */
export interface AnytypeOptionRow {
  name?: string
  color?: AnytypeColor | (string & {})
}

export type AnytypeFilterCondition =
  | 'equal'
  | 'not_equal'
  | 'greater'
  | 'less'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'empty'
  | 'not_empty'
  | 'all_in'
  | 'not_all_in'
  | 'exact_in'
  | 'not_exact_in'
  | 'exists'

/**
 * A date is compared as unix seconds, and rounded out to whole local days: `greater_or_equal`
 * to the start of its day, `less_or_equal` to its end. `less_or_equal` also matches an empty
 * value, so pair it with `not_empty`. A select takes option names.
 */
export interface AnytypeFilterLeaf {
  property: string
  condition: AnytypeFilterCondition
  value?: unknown
  include_time?: boolean
}

export interface AnytypeFilterGroup {
  operator: 'and' | 'or'
  filters: AnytypeFilter[]
}

/** Filters listed side by side combine with an implicit `and`. */
export type AnytypeFilter = AnytypeFilterLeaf | AnytypeFilterGroup

/**
 * Prefer `filters` to the compact `filter` string, whose grammar cannot spell a key that starts
 * with a digit, as the keys Anytype mints for user properties may. Searches leave archived
 * objects out.
 */
export interface AnytypeSearchRequest {
  type?: string
  query?: string
  filters?: AnytypeFilter[]
  filter?: string
  sorts?: Record<string, unknown>[]
  /** Only these properties come back per row. A key the type lacks answers 400. */
  fields?: string[]
}

/**
 * Only the fields asked for. A date is a bare RFC 3339 string in UTC; a select, the list of its
 * picked options' names; a property the object has no value for is left out, an unticked
 * checkbox among them.
 */
export interface AnytypeObjectRow {
  id?: string
  name?: string
  type?: string
  space_id?: string
  properties?: Record<string, unknown>
}

/** A view of a query or collection. `id` is a compact suffix, accepted back like the full one. */
export interface AnytypeView {
  id?: string
  name?: string
  type?: string
  filters?: unknown[]
  [member: string]: unknown
}

/**
 * `GET …/objects/{id}`, an AnyBlock document. A query's names what it runs over in
 * `query_source`, e.g. `{ types: ['task'] }`.
 */
export interface AnytypeObjectDocument {
  id?: string
  kind?: string
  properties?: Record<string, unknown>
  query_source?: { types?: string[]; [member: string]: unknown }
  [member: string]: unknown
}

/** A date is written as RFC 3339, the spelling it is read back in. */
export interface AnytypeObjectCreate {
  type: string
  name?: string
  markdown?: string
  template?: string
  properties?: Record<string, unknown>
}

export interface AnytypeCreated {
  id?: string
  etag?: string
  type?: string
  warnings?: AnytypeIssue[]
}

/** Only the op this client has been used with is typed; the others pass through as given. */
export type AnytypeObjectOp =
  | { op: 'set_properties'; set: Record<string, unknown> }
  | { op: string; [member: string]: unknown }

export interface AnytypeEdited {
  etag?: string
  warnings?: AnytypeIssue[]
}

export interface AnytypeFile {
  contentType: string | null
  bytes: Uint8Array
}
