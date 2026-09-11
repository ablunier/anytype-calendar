/* The ten frames of the design's screen flow, and the mapping between a frame id and the
 * state that produces it.
 *
 * This exists for the FlowSwitcher harness. An auth frame is a real session, forced in main
 * through a dev-only IPC channel, so the screen follows it exactly as it follows the live
 * flow. The other frames set the renderer's local screen state, since those screens still
 * run on mock data — and forcing a connected session is what lets them be opened at all.
 */

import type { SessionSnapshot } from '@shared/ipc'
import type { ConnectedScreen } from '@renderer/types'
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

export const DETAIL_FRAME_EVENT_ID = 11

export interface FrameState {
  session: SessionSnapshot
  screen: ConnectedScreen
  confirmingRevoke: boolean
  showDetail: boolean
}

/** The design's sample key: …4c19, added 2026-03-01. */
const SAMPLE_CONNECTED: SessionSnapshot = {
  phase: 'connected',
  key: { hint: '4c19', issuedAt: Date.UTC(2026, 2, 1) }
}

/** `now` anchors the sample challenge, so the code frame always opens on the design's 0:42. */
export function frameToState(id: string, now: number): FrameState {
  const challenge = { id: 'ch_8f2a41', expiresAt: now + 42_000 }
  const attempt = { challenge, code: '2749' }
  const auth = (session: SessionSnapshot): FrameState => ({
    session,
    screen: 'success',
    confirmingRevoke: false,
    showDetail: false
  })
  const connected = (screen: ConnectedScreen, overrides: Partial<FrameState> = {}): FrameState => ({
    ...auth(SAMPLE_CONNECTED),
    screen,
    ...overrides
  })

  switch (id) {
    case 'auth:code':
      return auth({ phase: 'awaiting-code', challenge })
    case 'auth:verifying':
      return auth({ phase: 'verifying', attempt })
    case 'auth:error':
      return auth({ phase: 'failed', failure: 'invalid-code', attempt })
    case 'auth:success':
      return connected('success')
    case 'onboarding':
      return connected('onboarding')
    case 'config':
      return connected('config')
    case 'config:revoke':
      return connected('config', { confirmingRevoke: true })
    case 'month':
      return connected('month')
    case 'month:detail':
      return connected('month', { showDetail: true })
    default:
      return auth({ phase: 'signed-out' })
  }
}

export function stateToFrame({ session, screen, confirmingRevoke, showDetail }: FrameState): string {
  switch (session.phase) {
    case 'signed-out':
      return 'auth:start'
    case 'awaiting-code':
      return 'auth:code'
    case 'verifying':
      return 'auth:verifying'
    case 'failed':
      return 'auth:error'
    case 'connected':
      switch (screen) {
        case 'success':
          return 'auth:success'
        case 'onboarding':
          return 'onboarding'
        case 'config':
          return confirmingRevoke ? 'config:revoke' : 'config'
        case 'month':
          return showDetail ? 'month:detail' : 'month'
      }
  }
}
