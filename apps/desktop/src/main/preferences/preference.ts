import type { AppConfigStore } from '../app-config-file'

export type PreferenceListener<T> = (value: T) => void

export class PreferenceStore<T> {
  #value: T
  readonly #equals: (a: T, b: T) => boolean
  readonly #listeners = new Set<PreferenceListener<T>>()

  constructor(initial: T, equals: (a: T, b: T) => boolean = (a, b) => a === b) {
    this.#value = initial
    this.#equals = equals
  }

  get(): T {
    return this.#value
  }

  /** Setting what it already holds notifies no one. */
  set(value: T): void {
    if (this.#equals(value, this.#value)) return
    this.#value = value
    for (const listener of this.#listeners) listener(value)
  }

  subscribe(listener: PreferenceListener<T>): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

/** `Saved` narrows `State` when the state holds something no one may save, such as a missing theme. */
export interface PreferenceOptions<State, Saved extends State> {
  config: AppConfigStore
  section: string
  /** Held until a load, and whenever the saved value is missing or not one. */
  initial: State
  /** Undefined for anything that is not a value, so `null` can be one. */
  parse: (value: unknown) => Saved | undefined
  equals?: (a: State, b: State) => boolean
}

export interface Preference<State, Saved extends State = State> {
  state: PreferenceStore<State>
  parse: (value: unknown) => Saved | undefined
  load(): Promise<void>
  save(value: Saved): Promise<void>
}

/**
 * One setting kept in its own section of the app config file. A save needs no queue of its
 * own: every read and write of the file already goes through one.
 */
export function preference<State, Saved extends State = State>({
  config,
  section,
  initial,
  parse,
  equals
}: PreferenceOptions<State, Saved>): Preference<State, Saved> {
  const state = new PreferenceStore(initial, equals)
  return {
    state,
    parse,
    async load() {
      // A corrupted section falls back to the initial value rather than failing startup.
      const value = parse(await config.readSection(section))
      state.set(value === undefined ? initial : value)
    },
    // Written before it is shown, so the app never draws what a restart would lose.
    async save(value) {
      await config.writeSection(section, value)
      state.set(value)
    }
  }
}
