import {
  isFeedsColour,
  toFeedsName,
  toFeedsUrl,
  type FeedsSubscription,
  type FeedsSubscriptionRepository
} from '../../domain'

/** Backed by the OS keychain in the app (Electron safeStorage), sealing to text a JSON file can hold. */
export interface FeedsUrlCipher {
  seal(plain: string): string
  /** Throws when the text cannot be opened, e.g. after the keychain was reset. */
  open(sealed: string): string
}

export interface FeedsSubscriptionFile {
  /** Null when there is no file. */
  read(): Promise<string | null>
  /** Must replace the file atomically, so a crash never leaves half a list. */
  write(text: string): Promise<void>
}

export interface EncryptedFileFeedsSubscriptionRepositoryOptions {
  cipher: FeedsUrlCipher
  file: FeedsSubscriptionFile
}

const VERSION = 1

/**
 * Keeps the subscriptions in a JSON file, in order, each address sealed: anyone holding a
 * secret ICS address can read that calendar. Names and colours stay readable. A file that
 * cannot be read back loads as no subscriptions, and an entry that cannot is left out, so a
 * bad file never stops the app from starting.
 */
export class EncryptedFileFeedsSubscriptionRepository implements FeedsSubscriptionRepository {
  readonly #cipher: FeedsUrlCipher
  readonly #file: FeedsSubscriptionFile

  constructor({ cipher, file }: EncryptedFileFeedsSubscriptionRepositoryOptions) {
    this.#cipher = cipher
    this.#file = file
  }

  async load(): Promise<FeedsSubscription[]> {
    try {
      const text = await this.#file.read()
      if (text === null) return []
      const { subscriptions } = JSON.parse(text) as { subscriptions?: unknown }
      if (!Array.isArray(subscriptions)) return []
      const ids = new Set<string>()
      return subscriptions.flatMap((entry: unknown) => {
        const subscription = this.#toSubscription(entry)
        if (!subscription || ids.has(subscription.id)) return []
        ids.add(subscription.id)
        return [subscription]
      })
    } catch {
      return []
    }
  }

  async save(subscriptions: readonly FeedsSubscription[]): Promise<void> {
    const sealed = subscriptions.map(({ id, name, colour, url }) => ({
      id,
      name,
      colour,
      url: this.#cipher.seal(url)
    }))
    await this.#file.write(JSON.stringify({ version: VERSION, subscriptions: sealed }, null, 2))
  }

  #toSubscription(entry: unknown): FeedsSubscription | null {
    if (typeof entry !== 'object' || entry === null) return null
    const { id, name, colour, url } = entry as Record<string, unknown>
    if (typeof id !== 'string' || !/^[0-9a-z]+$/i.test(id) || typeof url !== 'string') return null
    let address: string | null
    try {
      address = toFeedsUrl(this.#cipher.open(url))
    } catch {
      return null
    }
    const readName = toFeedsName(name)
    if (address === null || readName === null) return null
    return { id, name: readName, url: address, colour: isFeedsColour(colour) ? colour : 'blue' }
  }
}
