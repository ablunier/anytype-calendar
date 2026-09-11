import type { SchemaSelection } from '../model/selection'

/** Holds at most one selection. */
export interface SchemaSelectionRepository {
  /** Null when none was ever saved. */
  load(): Promise<SchemaSelection | null>
  save(selection: SchemaSelection): Promise<void>
}
