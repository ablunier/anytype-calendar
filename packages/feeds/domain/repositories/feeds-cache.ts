/** The last good copy of a feed, so it is drawn at launch, and offline, before any read answers. */
export interface FeedsCopy {
  text: string
  /** Epoch milliseconds. */
  readAt: number
}

export interface FeedsCache {
  /** Null when there is none, or it cannot be read back. */
  read(feedId: string): Promise<FeedsCopy | null>
  write(feedId: string, copy: FeedsCopy): Promise<void>
  /** Succeeds when there is none. */
  remove(feedId: string): Promise<void>
}
