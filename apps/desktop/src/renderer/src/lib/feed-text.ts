import type { TFunction } from 'i18next'
import type { FeedFailure, FeedStatus } from '@renderer/types'
import { syncDetailText } from './sync-text'

/** Why a feed could not be read, or added. */
export function feedFailureText(t: TFunction, { failure, ...rest }: FeedFailure): string {
  switch (failure) {
    case 'unreachable':
      return t('feeds.failure.unreachable')
    case 'http':
      return t('feeds.failure.http', { status: 'status' in rest ? rest.status : 0 })
    case 'not-calendar':
      return t('feeds.failure.notCalendar')
    case 'invalid-url':
      return t('feeds.failure.invalidUrl')
    case 'invalid-name':
      return t('feeds.failure.invalidName')
  }
}

/** How a subscription's last read went: when it was read, and why the latest failed, if it did. */
export function feedStatusText(t: TFunction, { state, elapsed, failure }: FeedStatus): string {
  const read = elapsed
    ? t('feeds.status.read', { elapsed: syncDetailText(t, { kind: 'elapsed', elapsed }) })
    : t('feeds.status.neverRead')
  if (state === 'syncing') return t('feeds.status.reading')
  if (failure) return `${feedFailureText(t, failure)} ${elapsed ? t('feeds.status.keptCopy', { read }) : ''}`.trim()
  return read
}
