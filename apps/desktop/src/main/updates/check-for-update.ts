import type { AppConfigStore } from '../app-config-file'
import { compareVersions, type LatestRelease } from './release-version'
import type { UpdateNoticeStore } from './update-notice-store'

/** Holds the version whose notice was closed, so a newer one shows again. */
export const DISMISSED_UPDATE_SECTION = 'dismissedUpdate'

export interface CheckForUpdateDeps {
  config: AppConfigStore
  store: UpdateNoticeStore
  /** Null when there is no release, or it could not be read. */
  fetchLatest: () => Promise<LatestRelease | null>
}

/** A failed check keeps whatever the last one found. */
export class CheckForUpdate {
  readonly #config: AppConfigStore
  readonly #store: UpdateNoticeStore
  readonly #fetchLatest: () => Promise<LatestRelease | null>

  constructor({ config, store, fetchLatest }: CheckForUpdateDeps) {
    this.#config = config
    this.#store = store
    this.#fetchLatest = fetchLatest
  }

  async execute(): Promise<void> {
    const latest = await this.#fetchLatest()
    if (!latest) return
    const { current } = this.#store.get()
    const newer = (compareVersions(latest.version, current) ?? 0) > 0
    const dismissed = await this.#config.readSection(DISMISSED_UPDATE_SECTION)
    this.#store.set({
      current,
      available: newer ? latest : null,
      dismissed: newer && dismissed === latest.version
    })
  }
}

export interface DismissUpdateNoticeDeps {
  config: AppConfigStore
  store: UpdateNoticeStore
}

export class DismissUpdateNotice {
  readonly #config: AppConfigStore
  readonly #store: UpdateNoticeStore

  constructor({ config, store }: DismissUpdateNoticeDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(): Promise<void> {
    const notice = this.#store.get()
    if (!notice.available || notice.dismissed) return
    await this.#config.writeSection(DISMISSED_UPDATE_SECTION, notice.available.version)
    this.#store.set({ ...notice, dismissed: true })
  }
}
