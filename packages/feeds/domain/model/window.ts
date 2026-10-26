/** Epoch milliseconds, both ends inclusive: the stretch of calendar on screen. */
export interface FeedsWindow {
  start: number
  end: number
}

export function overlapsFeedsWindow(
  { start, end }: { start: number; end: number | null },
  window: FeedsWindow
): boolean {
  return start <= window.end && (end ?? start) >= window.start
}

export function sameFeedsWindow(a: FeedsWindow | null, b: FeedsWindow | null): boolean {
  return a === b || (a !== null && b !== null && a.start === b.start && a.end === b.end)
}
