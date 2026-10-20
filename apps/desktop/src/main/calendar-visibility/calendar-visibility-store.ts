import type { CalendarVisibilitySnapshot } from '@shared/ipc'

export type CalendarVisibilityListener = (visibility: CalendarVisibilitySnapshot) => void

export const SHOWING_EVERYTHING: CalendarVisibilitySnapshot = { hidden: [], collapsed: false }

/**
 * Null: not a saved visibility. Within an object, a malformed field falls back to its default
 * rather than discarding the other, and a key repeated is kept once.
 */
export function toCalendarVisibility(value: unknown): CalendarVisibilitySnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const { hidden, collapsed } = value as Record<string, unknown>
  return {
    hidden: Array.isArray(hidden)
      ? [...new Set(hidden.filter((key): key is string => typeof key === 'string' && key !== ''))]
      : [],
    collapsed: collapsed === true
  }
}

export class CalendarVisibilityStore {
  #visibility = SHOWING_EVERYTHING
  readonly #listeners = new Set<CalendarVisibilityListener>()

  get(): CalendarVisibilitySnapshot {
    return this.#visibility
  }

  /** Setting what it already holds notifies no one. */
  set(visibility: CalendarVisibilitySnapshot): void {
    const { hidden, collapsed } = this.#visibility
    if (
      visibility.collapsed === collapsed &&
      visibility.hidden.length === hidden.length &&
      visibility.hidden.every((key, index) => key === hidden[index])
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
