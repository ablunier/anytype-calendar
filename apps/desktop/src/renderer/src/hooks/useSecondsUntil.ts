import { useEffect, useState } from 'react'

/** Ticks faster than once a second so the display never lags a whole second behind. */
const TICK_MS = 250

export function useSecondsUntil(deadline: number): number {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])

  return Math.max(0, Math.ceil((deadline - now) / 1000))
}
