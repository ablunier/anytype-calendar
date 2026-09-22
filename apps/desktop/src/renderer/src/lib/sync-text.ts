import type { TFunction } from 'i18next'
import type { SyncDetail } from '@renderer/types'

/** Resolves a `SyncDetail` (from `lib/schema.ts`/`lib/events.ts`) to the text `SyncStatus` draws. */
export function syncDetailText(t: TFunction, detail: SyncDetail | undefined): string | undefined {
  if (!detail) return undefined
  switch (detail.kind) {
    case 'unauthorized':
      return t('sync.failure.unauthorized')
    case 'unreachable':
      return t('sync.failure.unreachable')
    case 'elapsed':
      switch (detail.elapsed.key) {
        case 'justNow':
          return t('sync.elapsed.justNow')
        case 'minutesAgo':
          return t('sync.elapsed.minutesAgo', { count: detail.elapsed.count })
        case 'hoursAgo':
          return t('sync.elapsed.hoursAgo', { count: detail.elapsed.count })
        case 'daysAgo':
          return t('sync.elapsed.daysAgo', { count: detail.elapsed.count })
      }
  }
}
