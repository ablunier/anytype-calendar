import type { TimeFormatSnapshot } from '@shared/ipc'
import { createContext, useContext } from 'react'

/** Context rather than a prop: every component that draws a time would otherwise pass it down. */
export const TimeFormatContext = createContext<TimeFormatSnapshot>('24h')

export function useTimeFormatValue(): TimeFormatSnapshot {
  return useContext(TimeFormatContext)
}
