import { rekeySchemaSelection, type SchemaSpace } from '../domain'
import type { SaveSchemaSelection } from './save-schema-selection'

/** Run after each sync, so a type chosen while the app read through v1 follows v2's key. */
export class RekeySchemaSelection {
  readonly #save: SaveSchemaSelection

  constructor(save: SaveSchemaSelection) {
    this.#save = save
  }

  execute(spaces: readonly SchemaSpace[]): Promise<void> {
    return this.#save.rewrite((selection) => rekeySchemaSelection(selection, spaces))
  }
}
