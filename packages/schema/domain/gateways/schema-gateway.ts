import type { SchemaProperty } from '../model/date-property'
import type { SchemaTypeIcon } from '../model/type'

export interface SchemaSpaceRef {
  id: string
  name: string
}

export interface SchemaSpaceList {
  spaces: SchemaSpaceRef[]
  /**
   * The key's grant leaves out spaces the account has. Only v2 can tell: v1 reads as false,
   * as does a key that reaches every space.
   */
  hasNotGrantedSpaces: boolean
}

export interface SchemaTypeRef {
  key: string
  /** How v1 of the local API spelled the key, where v2 spells it otherwise. */
  formerKey?: string
  name: string
  icon: SchemaTypeIcon | null
  properties: SchemaProperty[]
}

/**
 * A refused key is an expected answer, not an error, so it is a value; only a transport
 * breakdown or a response Anytype should never give rejects the promise.
 */
export type SchemaGatewayResult<T> = { ok: true; value: T } | { ok: false; failure: 'unauthorized' }

export interface SchemaGateway {
  /**
   * Leaves out Anytype's own tech space, and one-to-one chats where the API says which spaces
   * those are (v1 does, v2 does not).
   */
  listSpaces(apiKey: string): Promise<SchemaGatewayResult<SchemaSpaceList>>

  /**
   * Leaves out archived types. A space the key is no longer granted holds none: the grant may
   * change between listing the spaces and reading one.
   */
  listTypes(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaTypeRef[]>>
}
