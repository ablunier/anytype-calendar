import type { CredentialFile } from '@anytype-calendar/auth/infrastructure'
import { atomicFileAt } from '../atomic-file'

export function credentialFileAt(path: string): CredentialFile {
  return atomicFileAt(path, 0o600)
}
