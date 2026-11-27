import type { AppConfigStore } from '../app-config-file'
import { CheckForUpdate, DismissUpdateNotice } from './check-for-update'
import { fetchLatestRelease } from './latest-release'
import { UpdateNoticeStore } from './update-notice-store'

export type Updates = ReturnType<typeof composeUpdates>

export function composeUpdates(appConfig: AppConfigStore, appVersion: string) {
  const updateNotice = new UpdateNoticeStore(appVersion)
  return {
    updateNotice,
    checkForUpdate: new CheckForUpdate({ config: appConfig, store: updateNotice, fetchLatest: fetchLatestRelease }),
    dismissUpdateNotice: new DismissUpdateNotice({ config: appConfig, store: updateNotice }),
  }
}
