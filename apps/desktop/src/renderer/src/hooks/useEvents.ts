import type { EventsSnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

export function useEvents(): EventsSnapshot | undefined {
  return usePushedState(window.api.events)
}
