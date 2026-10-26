import type { FeedsCache, FeedsCopy } from '../../domain'

/** A directory of text files, by name. */
export interface FeedsCacheDirectory {
  /** Null when there is no such file. */
  read(name: string): Promise<string | null>
  /** Must replace the file atomically, so a crash never leaves half a copy. */
  write(name: string, text: string): Promise<void>
  /** Succeeds when there is no such file. */
  remove(name: string): Promise<void>
}

/**
 * One file per feed, named by the subscription's id: random hex, so it can never name a file
 * outside the directory.
 */
export class FileFeedsCache implements FeedsCache {
  readonly #directory: FeedsCacheDirectory

  constructor(directory: FeedsCacheDirectory) {
    this.#directory = directory
  }

  async read(feedId: string): Promise<FeedsCopy | null> {
    try {
      const text = await this.#directory.read(fileOf(feedId))
      if (text === null) return null
      const { readAt, text: feed } = JSON.parse(text) as Record<string, unknown>
      return typeof feed === 'string' && typeof readAt === 'number' && Number.isFinite(readAt)
        ? { text: feed, readAt }
        : null
    } catch {
      return null
    }
  }

  async write(feedId: string, { text, readAt }: FeedsCopy): Promise<void> {
    await this.#directory.write(fileOf(feedId), JSON.stringify({ readAt, text }))
  }

  async remove(feedId: string): Promise<void> {
    await this.#directory.remove(fileOf(feedId))
  }
}

function fileOf(feedId: string): string {
  if (!/^[0-9a-z]+$/i.test(feedId)) throw new TypeError('not a feed id')
  return `${feedId}.json`
}
