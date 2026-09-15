import type { SchemaType } from './type'

export interface SchemaSpace {
  id: string
  name: string
  /** Only the types with a user date property, so only what could go on the calendar. */
  types: SchemaType[]
}
