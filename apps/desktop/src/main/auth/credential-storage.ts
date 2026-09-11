import { safeStorage } from 'electron'
import type { CredentialCipher, CredentialFile } from '@anytype-calendar/auth/infrastructure'
import { atomicFileAt } from '../atomic-file'

/** Only usable once the app is ready. */
export const safeStorageCipher: CredentialCipher = {
  encrypt: (plain) => safeStorage.encryptString(plain),
  decrypt: (sealed) => safeStorage.decryptString(Buffer.from(sealed))
}

export function credentialFileAt(path: string): CredentialFile {
  return atomicFileAt(path, 0o600)
}
