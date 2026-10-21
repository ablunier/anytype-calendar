import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { safeStorage } from 'electron'
import type {
  FeedsCacheDirectory,
  FeedsSubscriptionFile,
  FeedsUrlCipher
} from '@anytype-calendar/feeds/infrastructure'
import { atomicFileAt } from '../atomic-file'

/** Only usable once the app is ready. Sealed bytes are kept as Base64, which JSON can hold. */
export const safeStorageUrlCipher: FeedsUrlCipher = {
  seal: (plain) => safeStorage.encryptString(plain).toString('base64'),
  open: (sealed) => safeStorage.decryptString(Buffer.from(sealed, 'base64'))
}

/** Owner-only, like the credential: the addresses are sealed, but the names say what is followed. */
export function subscriptionFileAt(path: string): FeedsSubscriptionFile {
  const file = atomicFileAt(path, 0o600)
  return {
    read: async () => (await file.read())?.toString('utf8') ?? null,
    write: (text) => file.write(Buffer.from(text, 'utf8'))
  }
}

/** A calendar's events are as private as its address, so the copies are owner-only too. */
export function cacheDirectoryAt(path: string): FeedsCacheDirectory {
  return {
    read: (name) =>
      readFile(join(path, name), 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null
        throw error
      }),
    write: async (name, text) => {
      await mkdir(path, { recursive: true, mode: 0o700 })
      const staging = join(path, `${name}.tmp`)
      await writeFile(staging, text, { mode: 0o600 })
      await rename(staging, join(path, name))
    },
    remove: (name) => rm(join(path, name), { force: true })
  }
}
