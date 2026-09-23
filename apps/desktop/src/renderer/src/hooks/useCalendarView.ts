import type { CalendarView } from '@renderer/types'
import { usePushedState } from './usePushedState'

/**
 * The view a launch opens on — the month until main reports otherwise. What is drawn right now
 * is the shown span's own kind, not this: saving only settles where the next launch starts.
 * Saves go to main, which pushes the value back.
 */
export function useCalendarView(): [CalendarView, (view: CalendarView) => void] {
  const view = usePushedState(window.api.calendarView) ?? 'month'
  return [view, (next) => void window.api.calendarView.save(next)]
}
