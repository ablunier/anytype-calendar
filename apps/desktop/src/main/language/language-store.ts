export type Language = 'en' | 'es' | 'gl'

/** Null: no language was ever saved, so the renderer follows the OS language. */
export type LanguageState = Language | null

export type LanguageListener = (state: LanguageState) => void

const LANGUAGES: readonly Language[] = ['en', 'es', 'gl']

/**
 * Undefined for anything that is neither a supported language nor an explicit `null` — the
 * caller decides what that means (a load tolerates it and falls back to `null`; a save
 * rejects it), since unlike `toTheme`, `null` here is itself a valid value to round-trip
 * (the "System default" choice), not just the collapse target for invalid input.
 */
export function toLanguage(value: unknown): LanguageState | undefined {
  if (value === null) return null
  return LANGUAGES.includes(value as Language) ? (value as Language) : undefined
}

export class LanguageStore {
  #state: LanguageState = null
  readonly #listeners = new Set<LanguageListener>()

  get(): LanguageState {
    return this.#state
  }

  /** Setting the current value again notifies no one. */
  set(state: LanguageState): void {
    if (state === this.#state) return
    this.#state = state
    for (const listener of this.#listeners) listener(state)
  }

  subscribe(listener: LanguageListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
