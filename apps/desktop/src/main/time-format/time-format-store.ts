export type TimeFormat = "24h" | "12h";

export type TimeFormatListener = (format: TimeFormat) => void;

export const DEFAULT_TIME_FORMAT: TimeFormat = "24h";

/** Null: not a saved time-format preference. */
export function toTimeFormat(value: unknown): TimeFormat | null {
  return value === "24h" || value === "12h" ? value : null;
}

export class TimeFormatStore {
  #format = DEFAULT_TIME_FORMAT;
  readonly #listeners = new Set<TimeFormatListener>();

  get(): TimeFormat {
    return this.#format;
  }

  /** Setting the current value again notifies no one. */
  set(format: TimeFormat): void {
    if (format === this.#format) return;
    this.#format = format;
    for (const listener of this.#listeners) listener(format);
  }

  subscribe(listener: TimeFormatListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
