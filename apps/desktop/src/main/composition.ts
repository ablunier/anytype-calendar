import { randomBytes } from 'crypto'
import { setTimeout as sleep } from 'timers/promises'
import { AuthService, AuthSessionStore } from '@anytype-calendar/auth/application'
import {
  InMemoryAuthGateway,
  InMemoryCredentialRepository
} from '@anytype-calendar/auth/infrastructure'

export interface AppServices {
  authService: AuthService
  authSession: AuthSessionStore
}

/** The only place adapters are chosen. */
export function composeServices(): AppServices {
  const authSession = new AuthSessionStore()
  const authService = new AuthService({
    gateway: new InMemoryAuthGateway({
      sleep: (ms) => sleep(ms),
      log: (message) => console.info(message),
      randomId: () => randomBytes(3).toString('hex')
    }),
    credentials: new InMemoryCredentialRepository(),
    store: authSession,
    appName: 'Calendar for Anytype'
  })
  return { authService, authSession }
}
