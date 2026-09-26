export interface SchemaProperty {
  key: string
  name: string
  /** Anytype's property format, e.g. `date`, `text`, `select`. */
  format: string
  /**
   * How v1 of the local API spelled the key, where v2 spells it otherwise: a selection saved
   * under v1 names the property this way. See rekeySchemaSelection.
   */
  formerKey?: string
}

/**
 * Date properties Anytype maintains on its own. Every object carries some of them, so an
 * object is not "dated" by having one. The local API does not flag system properties, so
 * they are named here.
 */
export const SCHEMA_SYSTEM_DATE_KEYS: ReadonlySet<string> = new Set([
  'created_date',
  'last_modified_date',
  'last_opened_date',
  'added_date',
  'last_message_date'
])

export interface SchemaDateProperty {
  key: string
  name: string
  formerKey?: string
}

/** In the order given, which for Anytype is the order the type lists them in. */
export function userDateProperties(properties: readonly SchemaProperty[]): SchemaDateProperty[] {
  return properties
    .filter((property) => property.format === 'date' && !SCHEMA_SYSTEM_DATE_KEYS.has(property.key))
    .map(({ key, name, formerKey }) => (formerKey === undefined ? { key, name } : { key, name, formerKey }))
}
