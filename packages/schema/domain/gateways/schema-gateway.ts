import type { SchemaCollection } from '../model/collection'
import type { SchemaProperty } from '../model/date-property'
import type { SchemaQueryView } from '../model/query'
import type { SchemaSelectOption } from '../model/select-property'
import type { SchemaTypeIcon } from '../model/type'

export interface SchemaSpaceRef {
  id: string
  name: string
  /** A `data:` URL of the space's own image; left off when it has none, or it could not be read. */
  icon?: string
}

export interface SchemaSpaceList {
  spaces: SchemaSpaceRef[]
  /** The key's grant leaves out spaces the account has; false for a key that reaches every space. */
  hasNotGrantedSpaces: boolean
}

export interface SchemaTypeRef {
  key: string
  /**
   * How v1 of the local API spelled the key, where v2 spells it otherwise: a selection saved
   * while the app read through v1 names the type this way. See rekeySchemaSelection.
   */
  formerKey?: string
  name: string
  icon: SchemaTypeIcon | null
  /**
   * The ones the type lists, then any its templates show in their content without the type
   * listing them.
   */
  properties: SchemaProperty[]
}

export interface SchemaQueryRef {
  id: string
  name: string
  /** The types it runs over, as the API spells their keys; empty for one over no type. */
  typeKeys: string[]
  /** Never empty: Anytype keeps at least one. */
  views: SchemaQueryView[]
}

/**
 * A refused key, or an Anytype too old to serve v2 of its API, is an expected answer, not an
 * error, so it is a value; only a transport breakdown or a response Anytype should never give
 * rejects the promise.
 */
export type SchemaGatewayResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: 'unauthorized' | 'outdated' }

export interface SchemaGateway {
  /** Leaves out Anytype's own tech space. */
  listSpaces(apiKey: string): Promise<SchemaGatewayResult<SchemaSpaceList>>

  /**
   * Leaves out archived types. A space the key is no longer granted holds none: the grant may
   * change between listing the spaces and reading one.
   */
  listTypes(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaTypeRef[]>>

  /** A select property's options. Empty for a property or space that is gone or no longer granted. */
  listSelectOptions(
    apiKey: string,
    spaceId: string,
    propertyKey: string
  ): Promise<SchemaGatewayResult<SchemaSelectOption[]>>

  /** Leaves out archived queries. Empty for a space no longer granted. */
  listQueries(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaQueryRef[]>>

  /** Leaves out archived collections. Empty for a space no longer granted. */
  listCollections(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaCollection[]>>
}
