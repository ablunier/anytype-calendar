import type { FeedsOccurrence } from './occurrence'

/** An Occurrence tagged with the Subscription it was read from. */
export interface FeedsPlacedOccurrence extends FeedsOccurrence {
  /** The subscription it was read from. */
  feedId: string
  /** Where that subscription stands in the user's order. */
  rank: number
}

/** Earliest first; occurrences starting together by their subscription's place, then title, then id. */
export function compareFeedsPlacedOccurrences(a: FeedsPlacedOccurrence, b: FeedsPlacedOccurrence): number {
  if (a.start !== b.start) return a.start - b.start
  if (a.rank !== b.rank) return a.rank - b.rank
  if (a.title !== b.title) return a.title < b.title ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
