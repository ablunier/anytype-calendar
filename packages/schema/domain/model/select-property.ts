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
  /** Never empty: a select with no options has nothing to colour by. */
  options: SchemaSelectOption[]
}

/**
 * Properties Anytype bundles that a type's objects are ticked done by and placed by, until the
 * user picks others: a selection saved before they could be picked reads as these.
 */
export const SCHEMA_DONE_KEY = 'done'
export const SCHEMA_LOCATION_KEY = 'location'
