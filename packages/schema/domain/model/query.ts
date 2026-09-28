/** One of a query's stored views, each with its own filters and sorts. */
export interface SchemaQueryView {
  /** As the API serves it: a short suffix of the full id, which it accepts back. */
  id: string
  name: string
}

/**
 * A query (Anytype's "set") over one of the space's dated types. Its objects are that type's,
 * narrowed by the view read through, so they are placed by the type's date properties. Only
 * v2 of the local API serves queries.
 */
export interface SchemaQuery {
  /** Anytype's object id. */
  id: string
  name: string
  /** The key of the type it runs over, as the space's `types` spell it. */
  typeKey: string
  /** Never empty. In Anytype's order: the first is the one read when no view is chosen. */
  views: SchemaQueryView[]
}
