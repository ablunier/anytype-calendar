import { app } from 'electron'
import type { AppConfigStore } from '../app-config-file'
import { fetchLatestRelease } from './auto-update'
import { CheckForUpdate, DismissUpdateNotice } from './check-for-update'
import { UpdateNoticeStore } from './update-notice-store'

export type Updates = ReturnType<typeof composeUpdates>

export function composeUpdates(appConfig: AppConfigStore) {
  const updateNotice = new UpdateNoticeStore(app.getVersion())
  return {
    updateNotice,
    checkForUpdate: new CheckForUpdate({ config: appConfig, store: updateNotice, fetchLatest: fetchLatestRelease }),
    dismissUpdateNotice: new DismissUpdateNotice({ config: appConfig, store: updateNotice })
  }
}
