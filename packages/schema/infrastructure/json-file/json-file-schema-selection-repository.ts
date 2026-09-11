import { toSchemaSelection, type SchemaSelection, type SchemaSelectionRepository } from '../../domain'

export interface SchemaSelectionFile {
  /** Null when there is no file. */
  read(): Promise<string | null>
  /** Must replace the file atomically, so a crash never leaves half a selection. */
  write(text: string): Promise<void>
}

/** Bumped when the stored shape changes; a file of any other version loads as none. */
const FORMAT_VERSION = 1

/**
 * A file that cannot be read back — unreadable, not JSON, another version, or not a
 * selection — loads as no selection, so a bad file shows onboarding again instead of
 * stopping the app from starting.
 */
export class JsonFileSchemaSelectionRepository implements SchemaSelectionRepository {
  readonly #file: SchemaSelectionFile

  constructor(file: SchemaSelectionFile) {
    this.#file = file
  }

  async load(): Promise<SchemaSelection | null> {
    try {
      const text = await this.#file.read()
      if (text === null) return null
      const stored: unknown = JSON.parse(text)
      if (typeof stored !== 'object' || stored === null) return null
      const { version, selection } = stored as Record<string, unknown>
      return version === FORMAT_VERSION ? toSchemaSelection(selection) : null
    } catch {
      return null
    }
  }

  async save(selection: SchemaSelection): Promise<void> {
    await this.#file.write(JSON.stringify({ version: FORMAT_VERSION, selection }, null, 2))
  }
}
