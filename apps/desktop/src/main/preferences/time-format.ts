export type TimeFormat = '24h' | '12h'

export const DEFAULT_TIME_FORMAT: TimeFormat = '24h'

export function toTimeFormat(value: unknown): TimeFormat | undefined {
  return value === '24h' || value === '12h' ? value : undefined
}
