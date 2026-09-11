import type { CredentialRepository } from '../domain'

export class CopyAuthApiKey {
  readonly #credentials: CredentialRepository

  constructor(credentials: CredentialRepository) {
    this.#credentials = credentials
  }

  /**
   * Hands the stored key to `write` — a sink such as the clipboard — instead of returning
   * it, so the key goes no further than that one call. Resolves whether there was a key.
   */
  async execute(write: (apiKey: string) => void): Promise<boolean> {
    const credential = await this.#credentials.load()
    if (!credential) return false
    write(credential.apiKey)
    return true
  }
}
