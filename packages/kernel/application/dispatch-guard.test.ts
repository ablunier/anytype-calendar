import { describe, expect, test } from 'vitest'
import { DispatchGuard, type DispatchStore } from './dispatch-guard'

type CounterEvent = { type: 'increment' } | { type: 'reset' }

function counterReducer(state: number, event: CounterEvent): number {
  switch (event.type) {
    case 'increment':
      return state + 1
    case 'reset':
      return 0
  }
}

class FakeStore<S> implements DispatchStore<S> {
  #state: S
  constructor(initial: S) {
    this.#state = initial
  }
  get(): S {
    return this.#state
  }
  set(state: S): void {
    this.#state = state
  }
}

describe('dispatch', () => {
  test('runs the reducer against the store and returns the new state', () => {
    const store = new FakeStore(0)
    const guard = new DispatchGuard(store, counterReducer)

    const next = guard.dispatch({ type: 'increment' })

    expect(next).toBe(1)
    expect(store.get()).toBe(1)
  })
})

describe('isCurrent', () => {
  test('is true while the store still holds the given state', () => {
    const store = new FakeStore(0)
    const guard = new DispatchGuard(store, counterReducer)
    const state = guard.dispatch({ type: 'increment' })

    expect(guard.isCurrent(state)).toBe(true)
  })

  test('is false once something else changed the store', () => {
    const store = new FakeStore(0)
    const guard = new DispatchGuard(store, counterReducer)
    const state = guard.dispatch({ type: 'increment' })

    guard.dispatch({ type: 'increment' })

    expect(guard.isCurrent(state)).toBe(false)
  })
})
