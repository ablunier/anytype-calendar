import { app, BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'
import { FOCUS_REFRESH_INTERVAL_MS, throttled } from '../events/focus-refresh'
import { isFeedsId, toFeedsAddRequest, toFeedsEditRequest, toFeedsOrder } from './feeds-requests'

/**
 * Feeds rarely change from one minute to the next, and many providers refresh what they
 * publish only every few hours, so a half-hourly read stays current without hammering them.
 */
const FEEDS_REFRESH_INTERVAL_MS = 30 * 60_000

/**
 * Feeds are read whether or not Anytype is connected: they need nothing of it. Besides the
 * read at launch, each is read again every half hour, and when a window gains focus, at most
 * once per 30 seconds, like Anytype's objects.
 */
export function registerFeedsIpc({
  feedsState,
  addFeedsSubscription,
  editFeedsSubscription,
  removeFeedsSubscription,
  reorderFeedsSubscriptions,
  refreshFeeds
}: AppServices): void {
  ipcMain.handle(IpcChannel.feedsGet, () => feedsState.get())
  ipcMain.handle(IpcChannel.feedsAdd, (_event, value: unknown) => {
    const request = toFeedsAddRequest(value)
    if (!request) throw new TypeError('not a subscription to add')
    return addFeedsSubscription.execute(request)
  })
  ipcMain.handle(IpcChannel.feedsEdit, (_event, value: unknown) => {
    const request = toFeedsEditRequest(value)
    if (!request) throw new TypeError('not a subscription edit')
    return editFeedsSubscription.execute(request)
  })
  ipcMain.handle(IpcChannel.feedsRemove, (_event, id: unknown) => {
    if (!isFeedsId(id)) throw new TypeError('not a subscription id')
    return removeFeedsSubscription.execute(id)
  })
  ipcMain.handle(IpcChannel.feedsReorder, (_event, value: unknown) => {
    const ids = toFeedsOrder(value)
    if (!ids) throw new TypeError('not an order of subscriptions')
    return reorderFeedsSubscriptions.execute(ids)
  })
  ipcMain.handle(IpcChannel.feedsRefresh, () => refreshFeeds.execute())

  feedsState.subscribe((state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.feedsChanged, state)
    }
  })

  const refresh = (): void => void refreshFeeds.execute()
  setInterval(refresh, FEEDS_REFRESH_INTERVAL_MS)
  // Counted from now: the launch reads every feed already.
  const refreshOnFocus = throttled(refresh, FOCUS_REFRESH_INTERVAL_MS, Date.now, Date.now())
  app.on('browser-window-focus', refreshOnFocus)
}
