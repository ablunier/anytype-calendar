import type { LatestRelease } from './release-version'

export interface UpdateNotice {
  current: string
  /** A release newer than `current`; null until a check finds one. */
  available: LatestRelease | null
  /** The user closed the notice for `available`. */
  dismissed: boolean
}

export type UpdateNoticeListener = (notice: UpdateNotice) => void

export class UpdateNoticeStore {
  #notice: UpdateNotice
  readonly #listeners = new Set<UpdateNoticeListener>()

  constructor(current: string) {
    this.#notice = { current, available: null, dismissed: false }
  }

  get(): UpdateNotice {
    return this.#notice
  }

  /** Setting an equal notice again notifies no one. */
  set(notice: UpdateNotice): void {
    const last = this.#notice
    if (
      notice.current === last.current &&
      notice.available?.version === last.available?.version &&
      notice.available?.url === last.available?.url &&
      notice.dismissed === last.dismissed
    ) {
      return
    }
    this.#notice = notice
    for (const listener of this.#listeners) listener(notice)
  }

  subscribe(listener: UpdateNoticeListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
