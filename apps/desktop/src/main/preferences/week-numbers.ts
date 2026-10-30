export function toWeekNumbers(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}
