import type { AtomicFile } from './atomic-file'

export interface AppConfigStore {
  /** Null when the section was never saved, or the file is missing or unreadable. */
  readSection(key: string): Promise<unknown>
  /** Every other section already on disk is kept as is. */
  writeSection(key: string, value: unknown): Promise<void>
}

/**
 * One JSON file holding an object keyed by section, so unrelated settings — the schema
 * selection, the theme, anything added later — share a single file under userData instead
 * of each inventing its own. Reads and writes serialize through one queue, so a
 * read-modify-write of one section can never race a write to another and drop it.
 */
export function appConfigStore(file: AtomicFile): AppConfigStore {
  let queue: Promise<unknown> = Promise.resolve()

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task, task)
    queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  // Unreadable, not JSON, or not an object: treated as an empty document rather than
  // thrown, so one bad section never stops another from being read or written.
  const readDocument = async (): Promise<Record<string, unknown>> => {
    const bytes = await file.read()
    if (!bytes) return {}
    try {
      const parsed: unknown = JSON.parse(bytes.toString('utf8'))
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }

  return {
    readSection: (key) => enqueue(async () => (await readDocument())[key] ?? null),
    writeSection: (key, value) =>
      enqueue(async () => {
        const document = await readDocument()
        document[key] = value
        await file.write(Buffer.from(JSON.stringify(document, null, 2), 'utf8'))
      })
  }
}
