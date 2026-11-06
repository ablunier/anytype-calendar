import type { PushedSource } from '@renderer/hooks/usePushedState'
import { act } from '@testing-library/react'
import { type Mock, vi } from 'vitest'

export interface FakePushedSource<T> extends PushedSource<T> {
  get: Mock<PushedSource<T>['get']>
  onChange: Mock<PushedSource<T>['onChange']>
  /** Resolves the pending `get()`, as main answering. */
  answer(value: T): Promise<void>
  /** Calls every listener, as main pushing a change. */
  push(value: T): void
  readonly listeners: number
}

/** A source whose `get()` stays pending until the test answers, so pushes can land first. */
export function fakePushedSource<T>(): FakePushedSource<T> {
  const listeners = new Set<(value: T) => void>()
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return {
    get: vi.fn(() => promise),
    onChange: vi.fn((listener: (value: T) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    answer: async (value) => {
      // The hook sets state in a `.then`, so the act must wait out the promise's callbacks.
      await act(async () => resolve(value))
    },
    push: (value) => {
      act(() => {
        for (const listener of listeners) listener(value)
      })
    },
    get listeners() {
      return listeners.size
    },
  }
}
