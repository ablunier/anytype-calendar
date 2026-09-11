export interface SchemaSpace {
  id: string
  name: string
  /** Objects with a value in at least one user date property — see userDatePropertyKeys. */
  datedObjectCount: number
}
