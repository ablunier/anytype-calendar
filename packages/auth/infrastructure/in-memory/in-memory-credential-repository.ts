import type { AuthCredential, CredentialRepository } from '../../domain'

/** Forgets the key when the process exits, so every launch starts signed out. */
export class InMemoryCredentialRepository implements CredentialRepository {
  #credential: AuthCredential | null = null

  async load(): Promise<AuthCredential | null> {
    return this.#credential && { ...this.#credential }
  }

  async save(credential: AuthCredential): Promise<void> {
    this.#credential = { ...credential }
  }

  async clear(): Promise<void> {
    this.#credential = null
  }
}
