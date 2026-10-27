/** An object of Anytype's bundled Collection type, which a new object can be added to. */
export interface SchemaCollection {
  /** Anytype's object id. */
  id: string
  name: string
  /** Epoch milliseconds; null where Anytype keeps none. */
  lastModified: number | null
  /**
   * The names of the objects linking to it, read only where another collection in the space
   * has the same name, to tell them apart; empty otherwise.
   */
  backlinks: string[]
}
