import type { SchemaSelectionFile } from '@anytype-calendar/schema/infrastructure'
import { atomicFileAt } from '../atomic-file'

export function selectionFileAt(path: string): SchemaSelectionFile {
  const file = atomicFileAt(path, 0o644)
  return {
    read: async () => (await file.read())?.toString('utf8') ?? null,
    write: (text) => file.write(Buffer.from(text, 'utf8'))
  }
}
