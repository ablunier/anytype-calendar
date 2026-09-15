import type { SchemaSelectionFile } from '@anytype-calendar/schema/infrastructure'
import type { AppConfigStore } from '../app-config-file'

const SECTION = 'schemaSelection'

/** Adapts the schema selection section of the shared app config file. */
export function selectionFileAt(store: AppConfigStore): SchemaSelectionFile {
  return {
    read: async () => {
      const value = await store.readSection(SECTION)
      return value === null ? null : JSON.stringify(value)
    },
    write: (text) => store.writeSection(SECTION, JSON.parse(text))
  }
}
