import { toSchemaSelection, type SchemaSelection, type SchemaSelectionRepository } from '../../domain'

export interface SchemaSelectionFile {
  /** Null when there is no file. */
  read(): Promise<string | null>
  /** Must replace the file atomically, so a crash never leaves half a selection. */
  write(text: string): Promise<void>
}

/**
 * Bumped when the stored shape changes. Bumped to 2 when `SchemaTypeChoice` gained
 * `includesTime`, and to 3 when it gained `colourBy`.
 */
const FORMAT_VERSION = 3

/**
 * Versions still read, besides the current one: a version-2 choice lacks only `colourBy`,
 * which toSchemaSelection reads as none. A file of any other version loads as none.
 */
const READABLE_VERSIONS: ReadonlySet<unknown> = new Set([2, FORMAT_VERSION])

/**
 * A file that cannot be read back — unreadable, not JSON, an unreadable version, or not a
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
      return READABLE_VERSIONS.has(version) ? toSchemaSelection(selection) : null
    } catch {
      return null
    }
  }

  async save(selection: SchemaSelection): Promise<void> {
    await this.#file.write(JSON.stringify({ version: FORMAT_VERSION, selection }, null, 2))
  }
}
