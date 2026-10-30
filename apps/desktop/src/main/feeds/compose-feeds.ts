import { randomBytes } from 'crypto'
import { join } from 'path'
import { setTimeout as sleep } from 'timers/promises'
import { app, safeStorage } from 'electron'
import {
  AddFeedsSubscription,
  EditFeedsSubscription,
  FeedsStore,
  LoadFeeds,
  RefreshFeeds,
  RemoveFeedsSubscription,
  ReorderFeedsSubscriptions,
  SaveFeedsSubscriptions,
  ShowFeedsWindow
} from '@anytype-calendar/feeds/application'
import type {
  FeedsCache,
  FeedsGateway,
  FeedsSubscriptionRepository,
  FeedsWindow
} from '@anytype-calendar/feeds/domain'
import {
  EncryptedFileFeedsSubscriptionRepository,
  FileFeedsCache,
  HttpFeedsGateway,
  IcalFeedsCalendarParser,
  InMemoryFeedsCache,
  InMemoryFeedsGateway,
  InMemoryFeedsSubscriptionRepository,
  LocalFeedsTimeZone
} from '@anytype-calendar/feeds/infrastructure'
import type { Anytype } from '../anytype/compose-anytype'
import { cacheDirectoryAt, safeStorageUrlCipher, subscriptionFileAt } from './feeds-storage'

/** A feed comes from anywhere on the internet, and a big one takes a while to send. */
const FEED_REQUEST_TIMEOUT_MS = 30_000

export interface FeedsDeps {
  anytype: Anytype
  /** The feeds follow the span the calendar shows, which events holds. */
  shownWindow: () => FeedsWindow
}

export type Feeds = ReturnType<typeof composeFeeds>

/**
 * Feeds need nothing of Anytype: they are read, and kept, whether or not it is connected. Only
 * the fake account gets its own files, like the credential, so a sample feed added in fake
 * mode never shows against the real one.
 */
export function composeFeeds({ anytype, shownWindow }: FeedsDeps) {
  const fake = anytype.kind === 'fake'
  const feedsState = new FeedsStore()
  const { repository, cache } = feedsStorageFor(fake ? 'feeds-fake' : 'feeds')
  const gateway = fake ? inMemoryFeedsGateway() : httpFeedsGateway()
  const parser = new IcalFeedsCalendarParser(new LocalFeedsTimeZone())
  const save = new SaveFeedsSubscriptions({ repository, store: feedsState })
  const showFeedsWindow = new ShowFeedsWindow(feedsState)
  return {
    feedsState,
    loadFeeds: new LoadFeeds({ repository, cache, parser, store: feedsState }),
    refreshFeeds: new RefreshFeeds({ gateway, parser, cache, store: feedsState }),
    addFeedsSubscription: new AddFeedsSubscription({
      gateway,
      parser,
      cache,
      store: feedsState,
      save,
      newId: () => randomBytes(8).toString('hex')
    }),
    editFeedsSubscription: new EditFeedsSubscription({ gateway, parser, cache, store: feedsState, save }),
    removeFeedsSubscription: new RemoveFeedsSubscription({ save, cache }),
    reorderFeedsSubscriptions: new ReorderFeedsSubscriptions(save),
    // Expanding the copies in memory is all moving to another span takes: no feed is read again.
    showFeedsForSpan: (): void => showFeedsWindow.execute(shownWindow())
  }
}

function httpFeedsGateway(): FeedsGateway {
  return new HttpFeedsGateway((url, init) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(FEED_REQUEST_TIMEOUT_MS) })
  )
}

/** Every `.ics` address answers a sample feed around the current month. */
function inMemoryFeedsGateway(): FeedsGateway {
  console.info('[feeds] Fake feeds: add any https address ending in .ics to subscribe to a sample')
  return new InMemoryFeedsGateway({ sleep: (ms) => sleep(ms), now: Date.now })
}

/**
 * `<name>.json` holds the subscriptions, each address sealed as the API key is, and
 * `<name>-cache/` the last good copy of each feed. Without OS encryption neither is written:
 * a secret address is a credential, and its copy as private as it.
 */
function feedsStorageFor(name: string): { repository: FeedsSubscriptionRepository; cache: FeedsCache } {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[feeds] OS encryption is unavailable; subscriptions will not survive a restart')
    return { repository: new InMemoryFeedsSubscriptionRepository(), cache: new InMemoryFeedsCache() }
  }
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    console.warn('[feeds] No keyring found; feed addresses are stored obfuscated, not encrypted')
  }
  const userData = app.getPath('userData')
  return {
    repository: new EncryptedFileFeedsSubscriptionRepository({
      cipher: safeStorageUrlCipher,
      file: subscriptionFileAt(join(userData, `${name}.json`))
    }),
    cache: new FileFeedsCache(cacheDirectoryAt(join(userData, `${name}-cache`)))
  }
}
