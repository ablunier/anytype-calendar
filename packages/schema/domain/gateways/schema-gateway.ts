import type { SchemaProperty } from '../model/date-property'
import type { SchemaTypeIcon } from '../model/type'

export interface SchemaSpaceRef {
  id: string
  name: string
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
  listSpaces(apiKey: string): Promise<SchemaGatewayResult<SchemaSpaceRef[]>>

  /** Leaves out archived types. */
  listTypes(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaTypeRef[]>>
}
