/**
 * A refresh re-reads the whole account — every space's types, and a count per dated type —
 * as well as the month: tens of requests. At most one per 30 seconds still picks up an edit
 * made in Anytype by the time the user is back, without re-reading on every switch between
 * the two apps while they work side by side.
 */
export const FOCUS_REFRESH_INTERVAL_MS = 30_000

/**
 * Runs `action` at most once per `intervalMs`, dropping the calls in between. `lastRun` is
 * epoch milliseconds; pass the current time to drop calls right after something that already
 * did the work.
 */
export function throttled(
  action: () => void,
  intervalMs: number,
  now: () => number,
  lastRun = -Infinity
): () => void {
  let last = lastRun
  return () => {
    const at = now()
    if (at - last < intervalMs) return
    last = at
    action()
  }
}
