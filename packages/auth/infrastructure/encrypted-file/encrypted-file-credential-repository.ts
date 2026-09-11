import type { AuthCredential, CredentialRepository } from '../../domain'

/** Backed by the OS keychain in the app (Electron safeStorage). */
export interface CredentialCipher {
  encrypt(plain: string): Uint8Array
  /** Throws when the bytes cannot be decrypted, e.g. after the keychain was reset. */
  decrypt(sealed: Uint8Array): string
}

export interface CredentialFile {
  /** Null when there is no file. */
  read(): Promise<Uint8Array | null>
  /** Must replace the file atomically, so a crash never leaves half a credential. */
  write(bytes: Uint8Array): Promise<void>
  /** Succeeds when there is no file. */
  remove(): Promise<void>
}

export interface EncryptedFileCredentialRepositoryOptions {
  cipher: CredentialCipher
  file: CredentialFile
}

/**
 * Keeps the key across restarts, encrypted at rest. A file that cannot be read back —
 * unreadable, undecryptable, or not a credential — loads as no credential, so a bad file
 * signs the user out instead of stopping the app from starting.
 */
export class EncryptedFileCredentialRepository implements CredentialRepository {
  readonly #cipher: CredentialCipher
  readonly #file: CredentialFile

  constructor({ cipher, file }: EncryptedFileCredentialRepositoryOptions) {
    this.#cipher = cipher
    this.#file = file
  }

  async load(): Promise<AuthCredential | null> {
    try {
      const sealed = await this.#file.read()
      return sealed && toCredential(JSON.parse(this.#cipher.decrypt(sealed)))
    } catch {
      return null
    }
  }

  async save({ apiKey, issuedAt }: AuthCredential): Promise<void> {
    await this.#file.write(this.#cipher.encrypt(JSON.stringify({ apiKey, issuedAt })))
  }

  async clear(): Promise<void> {
    await this.#file.remove()
  }
}

function toCredential(value: unknown): AuthCredential | null {
  if (typeof value !== 'object' || value === null) return null
  const { apiKey, issuedAt } = value as Record<string, unknown>
  if (typeof apiKey !== 'string' || apiKey === '') return null
  if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt)) return null
  return { apiKey, issuedAt }
}
