import type { SchemaProperty } from './date-property'
import type { SchemaSelectOption } from './select-property'

/** The formats the detail panel can draw a property in. */
export type SchemaPanelFormat =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'url'
  | 'email'
  | 'phone'
  | 'objects'

const PANEL_FORMATS: ReadonlySet<string> = new Set<SchemaPanelFormat>([
  'text',
  'number',
  'select',
  'multi_select',
  'url',
  'email',
  'phone',
  'objects'
])

/**
 * Properties the panel already draws on its own: the object's name as its title, and its type
 * as a tag.
 */
const DRAWN_KEYS: ReadonlySet<string> = new Set(['name', 'type'])

/** A property of a type the detail panel can show beside an object's dates. */
export interface SchemaPanelProperty {
  key: string
  name: string
  format: SchemaPanelFormat
  /** A select's or multi-select's options, which name and colour its values. */
  options?: SchemaSelectOption[]
}

/** A property offered by name alone, e.g. as the Done checkbox or the Location text. */
export interface SchemaNamedProperty {
  key: string
  name: string
}

/**
 * In the order given, which for Anytype is the order the type lists them in. Leaves out the
 * ones Anytype itself hides (last modified by …), and the name and type, which the panel
 * draws anyway.
 */
export function panelProperties(properties: readonly SchemaProperty[]): Omit<SchemaPanelProperty, 'options'>[] {
  return properties.flatMap(({ key, name, format, hidden }) =>
    hidden === true || DRAWN_KEYS.has(key) || !isPanelFormat(format) ? [] : [{ key, name, format }]
  )
}

/** In the order given; the object's name is never one, since the panel draws it as its title. */
export function namedProperties(properties: readonly SchemaProperty[], format: string): SchemaNamedProperty[] {
  return properties.flatMap(({ key, name, format: own }) =>
    own !== format || DRAWN_KEYS.has(key) ? [] : [{ key, name }]
  )
}

function isPanelFormat(format: string): format is SchemaPanelFormat {
  return PANEL_FORMATS.has(format)
}
