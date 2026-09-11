import type { AuthCredential } from '../model/credential'

/** Holds at most one credential. */
export interface CredentialRepository {
  load(): Promise<AuthCredential | null>
  save(credential: AuthCredential): Promise<void>
  clear(): Promise<void>
}
