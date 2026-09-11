import type { SessionSnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

export function useSession(): SessionSnapshot | undefined {
  return usePushedState(window.api.session)
}
