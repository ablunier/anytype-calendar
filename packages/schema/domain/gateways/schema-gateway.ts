import type { SchemaProperty } from '../model/date-property'

export interface SchemaSpaceRef {
  id: string
  name: string
}

/**
 * A refused key is an expected answer, not an error, so it is a value; only a transport
 * breakdown or a response Anytype should never give rejects the promise.
 */
export type SchemaGatewayResult<T> = { ok: true; value: T } | { ok: false; failure: 'unauthorized' }

export interface SchemaGateway {
  /** Leaves out one-to-one chats and Anytype's own tech space. */
  listSpaces(apiKey: string): Promise<SchemaGatewayResult<SchemaSpaceRef[]>>

  listProperties(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaProperty[]>>

  /** Objects with a value in at least one of `propertyKeys`, which must not be empty. */
  countObjectsWithAnyValue(
    apiKey: string,
    spaceId: string,
    propertyKeys: readonly string[]
  ): Promise<SchemaGatewayResult<number>>
}
