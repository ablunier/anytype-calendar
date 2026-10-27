import type { SchemaCollection } from './collection'
import type { SchemaQuery } from './query'
import type { SchemaType } from './type'

export interface SchemaSpace {
  id: string
  name: string
  /** A `data:` URL of the space's own image, where it has one. */
  icon?: string
  /** Only the types with a user date property, so only what could go on the calendar. */
  types: SchemaType[]
  /** Only the ones over a type in `types`. */
  queries: SchemaQuery[]
  collections: SchemaCollection[]
}
