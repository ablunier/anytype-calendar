export type WeekNumbersListener = (shown: boolean) => void

/** Null: not a saved week-numbers preference. */
export function toWeekNumbers(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

export class WeekNumbersStore {
  #shown = false
  readonly #listeners = new Set<WeekNumbersListener>()

  get(): boolean {
    return this.#shown
  }

  /** Setting the current value again notifies no one. */
  set(shown: boolean): void {
    if (shown === this.#shown) return
    this.#shown = shown
    for (const listener of this.#listeners) listener(shown)
  }

  subscribe(listener: WeekNumbersListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
