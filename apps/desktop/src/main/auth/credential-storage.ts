import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { safeStorage } from 'electron'
import type { CredentialCipher, CredentialFile } from '@anytype-calendar/auth/infrastructure'

/** Only usable once the app is ready. */
export const safeStorageCipher: CredentialCipher = {
  encrypt: (plain) => safeStorage.encryptString(plain),
  decrypt: (sealed) => safeStorage.decryptString(Buffer.from(sealed))
}

/** Written beside the target and renamed over it: a rename within a directory is atomic. */
export function credentialFileAt(path: string): CredentialFile {
  const staging = `${path}.tmp`
  return {
    read: () =>
      readFile(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null
        throw error
      }),
    write: async (bytes) => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(staging, bytes, { mode: 0o600 })
      await rename(staging, path)
    },
    remove: () => rm(path, { force: true })
  }
}
