export const DEFAULT_WEEK_START = 0

/** Monday is 0, Sunday 6. */
export function toWeekStart(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6 ? value : undefined
}
