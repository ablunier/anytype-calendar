import { IpcChannel } from '@shared/ipc'
import type { CalendarIpcRegistrar } from '../platform'
import { isOpenableLink } from './links'

export function registerShellIpc(ipc: CalendarIpcRegistrar, openExternal: (url: string) => Promise<void>): void {
  ipc.handle(IpcChannel.shellOpenObject, (_event, objectId: unknown, spaceId: unknown) => {
    // Renderer input is untrusted, and this one is handed to the OS via openExternal.
    if (typeof objectId !== 'string' || typeof spaceId !== 'string') {
      throw new TypeError('objectId and spaceId must be strings')
    }
    const url = `anytype://object?objectId=${encodeURIComponent(objectId)}&spaceId=${encodeURIComponent(spaceId)}`
    return openExternal(url)
  })
  ipc.handle(IpcChannel.shellOpenLink, (_event, link: unknown) => {
    if (!isOpenableLink(link)) throw new TypeError('link must be an http, https, mailto or tel URL')
    return openExternal(link)
  })
}
