import type { CredentialCipher } from '@anytype-calendar/auth/infrastructure'
import type { FeedsUrlCipher } from '@anytype-calendar/feeds/infrastructure'

/** The OS keyring, as `safeStorage` offers it; the backend is only ever asked of Linux. */
export interface CalendarEncryption {
  isAvailable(): boolean
  selectedBackend(): string
  encrypt(plain: string): Buffer
  decrypt(sealed: Buffer): string
}

/** What composition takes from the host, so it can be built without Electron. */
export interface CalendarPlatform {
  userDataPath: string
  appVersion: string
  /** `process.platform`, injected because only Linux's keyring can be a plaintext fallback. */
  os: string
  encryption: CalendarEncryption
}

/** What each context's IPC module takes from the host, in place of `ipcMain` and the windows. */
export interface CalendarIpcRegistrar {
  handle(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown): void
  broadcast(channel: string, payload: unknown): void
  onWindowFocus(listener: () => void): void
}

export function credentialCipherOf(encryption: CalendarEncryption): CredentialCipher {
  return {
    encrypt: (plain) => encryption.encrypt(plain),
    decrypt: (sealed) => encryption.decrypt(Buffer.from(sealed)),
  }
}

export function feedsUrlCipherOf(encryption: CalendarEncryption): FeedsUrlCipher {
  return {
    seal: (plain) => encryption.encrypt(plain).toString('base64'),
    open: (sealed) => encryption.decrypt(Buffer.from(sealed, 'base64')),
  }
}
