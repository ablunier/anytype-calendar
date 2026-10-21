import type { FeedsSnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

export function useFeeds(): FeedsSnapshot | undefined {
  return usePushedState(window.api.feeds)
}
