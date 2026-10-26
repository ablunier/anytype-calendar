/** Why a feed could not be read. */
export type FeedsReadFailure =
  /** No answer: offline, a host that does not resolve, or one that timed out. */
  | { failure: 'unreachable' }
  /** The server answered with an error, e.g. 404 for an address since revoked. */
  | { failure: 'http'; status: number }
  /** It answered with something that is not an iCalendar feed, e.g. a sign-in page. */
  | { failure: 'not-calendar' }

/** Why a subscription was not added: nothing is saved for any of these. */
export type FeedsAddFailure = FeedsReadFailure | { failure: 'invalid-url' } | { failure: 'invalid-name' }

export type FeedsAddOutcome = { ok: true; id: string } | ({ ok: false } & FeedsAddFailure)

/** Why an edit was refused: nothing of it is saved. */
export type FeedsEditFailure = FeedsReadFailure | { failure: 'invalid-url' }

export type FeedsEditOutcome = { ok: true } | ({ ok: false } & FeedsEditFailure)

export interface FeedsReadStatus {
  /**
   * Epoch milliseconds of the last good read, the one whose events are drawn; at launch, the
   * cached copy's. Null before any.
   */
  readAt: number | null
  reading: boolean
  /** Why the latest read failed, at epoch milliseconds `at`; null when it did not. */
  error: (FeedsReadFailure & { at: number }) | null
}

export const UNREAD_FEED: FeedsReadStatus = { readAt: null, reading: false, error: null }
