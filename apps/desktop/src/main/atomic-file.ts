import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { dirname } from 'path'

export interface AtomicFile {
  /** Null when there is no file. */
  read(): Promise<Buffer | null>
  write(bytes: Uint8Array): Promise<void>
  /** Succeeds when there is no file. */
  remove(): Promise<void>
}

/** Written beside the target and renamed over it: a rename within a directory is atomic. */
export function atomicFileAt(path: string, mode: number): AtomicFile {
  const staging = `${path}.tmp`
  return {
    read: () =>
      readFile(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null
        throw error
      }),
    write: async (bytes) => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(staging, bytes, { mode })
      await rename(staging, path)
    },
    remove: () => rm(path, { force: true })
  }
}
