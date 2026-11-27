import { IpcChannel, type UpdateSnapshot } from '@shared/ipc'
import type { CalendarIpcRegistrar } from '../platform'
import type { Updates } from './compose-updates'
import type { UpdateNotice } from './update-notice-store'

/** The release page's URL stays in main, so the renderer can open nothing but that page. */
function snapshotOf({ current, available, dismissed }: UpdateNotice): UpdateSnapshot {
  return { current, available: available?.version ?? null, dismissed }
}

export function registerUpdateIpc(
  ipc: CalendarIpcRegistrar,
  openExternal: (url: string) => Promise<void>,
  { updateNotice, dismissUpdateNotice }: Updates,
): void {
  ipc.handle(IpcChannel.updateGet, () => snapshotOf(updateNotice.get()))
  ipc.handle(IpcChannel.updateDismiss, () => dismissUpdateNotice.execute())
  ipc.handle(IpcChannel.updateOpenRelease, async () => {
    const release = updateNotice.get().available
    if (release) await openExternal(release.url)
  })

  updateNotice.subscribe((notice) => ipc.broadcast(IpcChannel.updateChanged, snapshotOf(notice)))
}
