export type WeekStartListener = (day: number) => void;

export const DEFAULT_WEEK_START = 0;

/** Monday is 0, Sunday 6. Null: not a saved week-start preference. */
export function toWeekStart(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 6
    ? value
    : null;
}

export class WeekStartStore {
  #day = DEFAULT_WEEK_START;
  readonly #listeners = new Set<WeekStartListener>();

  get(): number {
    return this.#day;
  }

  /** Setting the current value again notifies no one. */
  set(day: number): void {
    if (day === this.#day) return;
    this.#day = day;
    for (const listener of this.#listeners) listener(day);
  }

  subscribe(listener: WeekStartListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
