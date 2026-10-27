import type { FeedsReadFailure } from '../model/read'

export type FeedsFetchFailure = Exclude<FeedsReadFailure, { failure: 'not-calendar' }>

export type FeedsFetchResult = { ok: true; text: string } | ({ ok: false } & FeedsFetchFailure)

/** Reads a feed's text from its address. Never rejects: a failure is a value. */
export interface FeedsGateway {
  fetch(url: string): Promise<FeedsFetchResult>
}

/** The failure alone, without the result's `ok`. */
export function feedsFetchFailureOf(result: { ok: false } & FeedsFetchFailure): FeedsFetchFailure {
  return result.failure === 'http' ? { failure: 'http', status: result.status } : { failure: result.failure }
}
