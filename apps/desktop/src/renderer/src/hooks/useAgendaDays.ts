import { DEFAULT_AGENDA_DAYS } from '@anytype-calendar/events/domain'
import type { AgendaDaysSnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

/**
 * How many days an agenda opened from here lists: two weeks until main reports otherwise. The
 * agenda on screen carries its own length, which main rereads to follow a save.
 */
export function useAgendaDays(): [AgendaDaysSnapshot, (days: AgendaDaysSnapshot) => void] {
  const days = usePushedState(window.api.agendaDays) ?? DEFAULT_AGENDA_DAYS
  return [days, (next) => void window.api.agendaDays.save(next)]
}
