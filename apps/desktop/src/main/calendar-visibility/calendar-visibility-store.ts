import type { CalendarVisibilitySnapshot } from '@shared/ipc'

export type CalendarVisibilityListener = (visibility: CalendarVisibilitySnapshot) => void

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
 * Null: not a saved visibility. Within an object, a malformed field falls back to its default
 * rather than discarding the others, and a key repeated is kept once.
 */
export function toCalendarVisibility(value: unknown): CalendarVisibilitySnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const { hidden, collapsed, collapsedSpaces } = value as Record<string, unknown>
  return { hidden: keysOf(hidden), collapsed: collapsed === true, collapsedSpaces: keysOf(collapsedSpaces) }
}

export class CalendarVisibilityStore {
  #visibility = SHOWING_EVERYTHING
  readonly #listeners = new Set<CalendarVisibilityListener>()

  get(): CalendarVisibilitySnapshot {
    return this.#visibility
  }

  /** Setting what it already holds notifies no one. */
  set(visibility: CalendarVisibilitySnapshot): void {
    const { hidden, collapsed, collapsedSpaces } = this.#visibility
    if (
      visibility.collapsed === collapsed &&
      sameKeys(visibility.hidden, hidden) &&
      sameKeys(visibility.collapsedSpaces, collapsedSpaces)
    ) {
      return
    }
    this.#visibility = visibility
    for (const listener of this.#listeners) listener(visibility)
  }

  subscribe(listener: CalendarVisibilityListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
