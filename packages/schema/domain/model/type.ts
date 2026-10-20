import type { SchemaDateProperty } from './date-property'
import type { SchemaNamedProperty, SchemaPanelProperty } from './panel-property'
import type { SchemaSelectProperty } from './select-property'

/** Anytype's own icon name and color, e.g. `checkbox` / `lime`. */
export interface SchemaTypeIcon {
  name: string
  color: string
}

/** Scoped to its space: the same type key in two spaces is two types. */
export interface SchemaType {
  /** Anytype's type key, e.g. `task`; unique within the space. */
  key: string
  /** How v1 of the local API spelled the key, where v2 spells it otherwise. */
  formerKey?: string
  name: string
  /** Null for a type drawn with an emoji or an image. */
  icon: SchemaTypeIcon | null
  /** Never empty — see userDateProperties. */
  dateProperties: SchemaDateProperty[]
  /** What its objects can be ticked done by. */
  checkboxProperties: SchemaNamedProperty[]
  /** What can say where its objects take place. */
  textProperties: SchemaNamedProperty[]
  /** What the detail panel can show of its objects; select options only where the API lists them (v2). */
  panelProperties: SchemaPanelProperty[]
  /** Only the ones with options; empty where the API cannot list options (v1). */
  selectProperties: SchemaSelectProperty[]
}
