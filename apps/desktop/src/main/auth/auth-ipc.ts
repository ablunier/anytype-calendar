import { IpcChannel } from '@shared/ipc'
import type { CalendarIpcRegistrar } from '../platform'
import type { Auth } from './compose-auth'

export function registerAuthIpc(
  ipc: CalendarIpcRegistrar,
  writeClipboard: (text: string) => void,
  {
    authSession,
    startAuthConnection,
    submitAuthCode,
    startAuthKeyEntry,
    submitAuthApiKey,
    stepBackAuthConnection,
    signOutOfAuth,
    copyAuthApiKey,
  }: Auth,
): void {
  ipc.handle(IpcChannel.sessionGet, () => authSession.get())
  ipc.handle(IpcChannel.authStart, () => startAuthConnection.execute())
  ipc.handle(IpcChannel.authSubmitCode, (_event, code: unknown) => {
    // Renderer input is untrusted; the domain ignores a malformed code, but not a non-string.
    if (typeof code !== 'string') throw new TypeError('auth code must be a string')
    return submitAuthCode.execute(code)
  })
  ipc.handle(IpcChannel.authEnterKey, () => startAuthKeyEntry.execute())
  ipc.handle(IpcChannel.authSubmitApiKey, (_event, apiKey: unknown) => {
    if (typeof apiKey !== 'string') throw new TypeError('API key must be a string')
    return submitAuthApiKey.execute(apiKey)
  })
  ipc.handle(IpcChannel.authStepBack, () => stepBackAuthConnection.execute())
  ipc.handle(IpcChannel.authSignOut, () => signOutOfAuth.execute())
  ipc.handle(IpcChannel.authCopyKey, () => copyAuthApiKey.execute((apiKey) => writeClipboard(apiKey)))

  authSession.subscribe((session) => ipc.broadcast(IpcChannel.sessionChanged, session))
}
