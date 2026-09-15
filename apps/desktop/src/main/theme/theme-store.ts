export type Theme = 'light' | 'dark'

/** Null: no theme was ever saved, so the renderer follows the OS setting. */
export type ThemeState = Theme | null

export type ThemeListener = (state: ThemeState) => void

export function toTheme(value: unknown): ThemeState {
  return value === 'light' || value === 'dark' ? value : null
}

export class ThemeStore {
  #state: ThemeState = null
  readonly #listeners = new Set<ThemeListener>()

  get(): ThemeState {
    return this.#state
  }

  /** Setting the current value again notifies no one. */
  set(state: ThemeState): void {
    if (state === this.#state) return
    this.#state = state
    for (const listener of this.#listeners) listener(state)
  }

  subscribe(listener: ThemeListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
