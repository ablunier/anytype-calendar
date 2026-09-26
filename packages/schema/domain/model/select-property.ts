/** One of a select property's options. */
export interface SchemaSelectOption {
  /** What an object's value names the option by. */
  name: string
  /** Anytype's own colour name, e.g. `red`, `lime`. */
  color: string
}

/** A `select` property of a type, whose option colours can colour its objects on the calendar. */
export interface SchemaSelectProperty {
  key: string
  name: string
  /** How v1 of the local API spelled the key, where v2 spells it otherwise. */
  formerKey?: string
  /** Never empty: a select with no options has nothing to colour by. */
  options: SchemaSelectOption[]
}

/**
 * Properties Anytype bundles whose value the calendar shows beside an object's dates. A type
 * has each only if it lists it; only these keys count, not a user property of the same name.
 */
export const SCHEMA_DONE_KEY = 'done'
export const SCHEMA_LOCATION_KEY = 'location'
