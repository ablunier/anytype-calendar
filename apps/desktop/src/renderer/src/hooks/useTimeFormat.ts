import type { TimeFormatSnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

/** 24h until main reports otherwise. Saves go to main, which pushes the value back. */
export function useTimeFormat(): [TimeFormatSnapshot, (format: TimeFormatSnapshot) => void] {
  const format = usePushedState(window.api.timeFormat) ?? '24h'
  return [format, (next) => void window.api.timeFormat.save(next)]
}
