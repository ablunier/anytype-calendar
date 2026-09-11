import { useNow } from './useNow'

/** Ticks faster than once a second so the display never lags a whole second behind. */
const TICK_MS = 250

export function useSecondsUntil(deadline: number): number {
  const now = useNow(TICK_MS)
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}
