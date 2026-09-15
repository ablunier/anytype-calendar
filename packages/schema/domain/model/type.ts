import type { SchemaDateProperty } from './date-property'

/** Anytype's own icon name and color, e.g. `checkbox` / `lime`. */
export interface SchemaTypeIcon {
  name: string
  color: string
}

/** Scoped to its space: the same type key in two spaces is two types. */
export interface SchemaType {
  /** Anytype's type key, e.g. `task`; unique within the space. */
  key: string
  name: string
  /** Null for a type drawn with an emoji or an image. */
  icon: SchemaTypeIcon | null
  /** Never empty — see userDateProperties. */
  dateProperties: SchemaDateProperty[]
}
