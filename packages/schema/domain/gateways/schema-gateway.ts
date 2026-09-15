import type { SchemaProperty } from '../model/date-property'
import type { SchemaTypeIcon } from '../model/type'

export interface SchemaSpaceRef {
  id: string
  name: string
}

export interface SchemaTypeRef {
  key: string
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
  /** Leaves out one-to-one chats and Anytype's own tech space. */
  listSpaces(apiKey: string): Promise<SchemaGatewayResult<SchemaSpaceRef[]>>

  /** Leaves out archived types. */
  listTypes(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaTypeRef[]>>
}
