import type { SchemaQuery } from './query'
import type { SchemaType } from './type'

export interface SchemaSpace {
  id: string
  name: string
  /** A `data:` URL of the space's own image, where it has one and the API serves it (v2). */
  icon?: string
  /** Only the types with a user date property, so only what could go on the calendar. */
  types: SchemaType[]
  /** Only the ones over a type in `types`; empty where the API serves none (v1). */
  queries: SchemaQuery[]
}
