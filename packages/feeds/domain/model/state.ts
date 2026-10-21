import type { FeedsEvent } from './event'
import type { FeedsReadStatus } from './read'
import type { FeedsColour } from './subscription'
import type { FeedsWindow } from './window'

/** A subscription as the user sees it: its address only by host, since the address is a credential. */
export interface FeedsSubscriptionView {
  id: string
  name: string
  colour: FeedsColour
  host: string
  status: FeedsReadStatus
}

export interface FeedsState {
  /** In the user's order. */
  subscriptions: FeedsSubscriptionView[]
  /** The window `events` covers; null until one was asked for. */
  window: FeedsWindow | null
  /** In the order of compareFeedsEvents. */
  events: FeedsEvent[]
}

export const NO_FEEDS: FeedsState = { subscriptions: [], window: null, events: [] }
