/* The ten frames of the design's screen flow, and the mapping between a frame id and the
 * screen state that produces it.
 *
 * This exists for the FlowSwitcher harness: several frames are states the product reaches
 * only through a backend that does not exist in this pass (a failed code exchange, a
 * pre-opened detail panel), so they need to be addressable directly.
 */

import type { AuthStage, ScreenId } from '@renderer/types'
import type { FlowFrame } from '@renderer/components/app/FlowSwitcher'

export const FRAMES: FlowFrame[] = [
  { id: 'auth:start', group: '1 · Auth', label: 'a. Start' },
  { id: 'auth:code', group: '1 · Auth', label: 'b. Code entry' },
  { id: 'auth:verifying', group: '1 · Auth', label: 'c. Verifying' },
  { id: 'auth:error', group: '1 · Auth', label: 'd. Error' },
  { id: 'auth:success', group: '1 · Auth', label: 'e. Success' },
  { id: 'onboarding', group: '2 · Onboarding', label: 'Spaces + types + dates' },
  { id: 'config', group: '3 · Settings', label: 'Config page' },
  { id: 'config:revoke', group: '3 · Settings', label: 'Revoke confirmation' },
  { id: 'month', group: '4 · Month view', label: 'Month grid' },
  { id: 'month:detail', group: '4 · Month view', label: 'Object detail' }
]

/** The object the flow's "Object detail" frame opens with. */
export const DETAIL_FRAME_EVENT_ID = 11

export interface FrameState {
  screen: ScreenId
  authStage: AuthStage
  confirmingRevoke: boolean
  showDetail: boolean
}

/** Parse a frame id into the screen state that renders it. */
export function frameToState(id: string): FrameState {
  const [name, variant] = id.split(':')
  return {
    screen: (name === 'auth' || name === 'config' || name === 'month'
      ? name
      : 'onboarding') as ScreenId,
    authStage: (name === 'auth' ? (variant ?? 'start') : 'start') as AuthStage,
    confirmingRevoke: name === 'config' && variant === 'revoke',
    showDetail: name === 'month' && variant === 'detail'
  }
}

/** The inverse: which frame the current screen state corresponds to. */
export function stateToFrame(state: {
  screen: ScreenId
  authStage: AuthStage
  confirmingRevoke: boolean
  showDetail: boolean
}): string {
  switch (state.screen) {
    case 'auth':
      return `auth:${state.authStage}`
    case 'config':
      return state.confirmingRevoke ? 'config:revoke' : 'config'
    case 'month':
      return state.showDetail ? 'month:detail' : 'month'
    default:
      return 'onboarding'
  }
}
