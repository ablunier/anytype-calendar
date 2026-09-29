import type { UpdateSnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

export function useUpdate(): UpdateSnapshot | undefined {
  return usePushedState(window.api.update)
}
