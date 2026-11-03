import type { CalendarVisibilitySnapshot } from '@shared/ipc'

export const SHOWING_EVERYTHING: CalendarVisibilitySnapshot = { hidden: [], collapsed: false, collapsedSpaces: [] }

function keysOf(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((key): key is string => typeof key === 'string' && key !== ''))]
    : []
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index])
}

/**
 * Within an object, a malformed field falls back to its default rather than discarding the
 * others, and a key repeated is kept once.
 */
export function toCalendarVisibility(value: unknown): CalendarVisibilitySnapshot | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { hidden, collapsed, collapsedSpaces } = value as Record<string, unknown>
  return { hidden: keysOf(hidden), collapsed: collapsed === true, collapsedSpaces: keysOf(collapsedSpaces) }
}

export function sameCalendarVisibility(a: CalendarVisibilitySnapshot, b: CalendarVisibilitySnapshot): boolean {
  return (
    a.collapsed === b.collapsed && sameKeys(a.hidden, b.hidden) && sameKeys(a.collapsedSpaces, b.collapsedSpaces)
  )
}
