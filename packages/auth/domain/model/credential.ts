/**
 * The secret. It lives only in the CredentialRepository and in the adapters that present
 * it to Anytype; nothing that leaves the main process may carry it.
 */
export interface AuthCredential {
  apiKey: string
  /** Epoch milliseconds. */
  issuedAt: number
}

/** What may be shown about the key: enough to recognise it, never enough to use it. */
export interface ApiKeyInfo {
  hint: string
  /** Epoch milliseconds. */
  issuedAt: number
}

const HINT_LENGTH = 4

export function apiKeyHint(apiKey: string): string {
  return apiKey.slice(-HINT_LENGTH)
}

export function describeCredential(credential: AuthCredential): ApiKeyInfo {
  return { hint: apiKeyHint(credential.apiKey), issuedAt: credential.issuedAt }
}
