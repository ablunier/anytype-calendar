/**
 * `auto` reads through v2 where Anytype serves it and v1 where not; `v1` never uses v2, a way
 * out should a change to the v2 pre-release break the app. Only the choice is saved, never the
 * major detected: that describes the running Anytype, which an update may change.
 */
export type ApiVersionPreference = 'auto' | 'v1'

export type ApiVersionListener = (preference: ApiVersionPreference) => void

export const DEFAULT_API_VERSION: ApiVersionPreference = 'auto'

/** Null: not a saved API-version preference. */
export function toApiVersion(value: unknown): ApiVersionPreference | null {
  return value === 'auto' || value === 'v1' ? value : null
}

export class ApiVersionStore {
  #preference = DEFAULT_API_VERSION
  readonly #listeners = new Set<ApiVersionListener>()

  get(): ApiVersionPreference {
    return this.#preference
  }

  /** Setting the current value again notifies no one. */
  set(preference: ApiVersionPreference): void {
    if (preference === this.#preference) return
    this.#preference = preference
    for (const listener of this.#listeners) listener(preference)
  }

  subscribe(listener: ApiVersionListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
