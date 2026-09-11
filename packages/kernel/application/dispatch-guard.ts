export interface DispatchStore<S> {
  get(): S
  set(state: S): void
}

/**
 * Wraps a store and its reducer so a use case can dispatch an event and later ask whether
 * the state that produced is still the one the store holds. An async use case captures the
 * state `dispatch` returns, does its I/O, then checks `isCurrent` before dispatching the
 * result — something else (a reset, a step back, a forced state) may have replaced it
 * meanwhile, and a stale result should be dropped rather than overwrite newer state.
 */
export class DispatchGuard<S, E> {
  readonly #store: DispatchStore<S>
  readonly #reducer: (state: S, event: E) => S

  constructor(store: DispatchStore<S>, reducer: (state: S, event: E) => S) {
    this.#store = store
    this.#reducer = reducer
  }

  current(): S {
    return this.#store.get()
  }

  dispatch(event: E): S {
    this.#store.set(this.#reducer(this.#store.get(), event))
    return this.#store.get()
  }

  isCurrent(state: S): boolean {
    return this.#store.get() === state
  }
}
