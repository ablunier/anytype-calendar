import { useRef } from 'react'
import type { CalendarVisibilitySnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

const SHOWING_EVERYTHING: CalendarVisibilitySnapshot = { hidden: [], collapsed: false, collapsedSpaces: [] }

/**
 * Everything shown and the sidebar open until main reports otherwise. Saves go to main, which
 * pushes the value back. An update is worked out from the latest value saved, not from the
 * last one drawn, so two toggles made before main has answered the first both count.
 */
export function useCalendarVisibility(): [
  CalendarVisibilitySnapshot,
  (change: (current: CalendarVisibilitySnapshot) => CalendarVisibilitySnapshot) => void
] {
  const visibility = usePushedState(window.api.calendarVisibility) ?? SHOWING_EVERYTHING
  const latest = useRef(visibility)
  latest.current = visibility
  return [
    visibility,
    (change) => {
      const next = change(latest.current)
      latest.current = next
      void window.api.calendarVisibility.save(next)
    }
  ]
}
