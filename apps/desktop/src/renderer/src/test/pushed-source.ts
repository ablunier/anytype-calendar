import type { PushedSource } from '@renderer/hooks/usePushedState'
import { act } from '@testing-library/react'
import { type Mock, vi } from 'vitest'

export interface FakePushedSource<T> extends PushedSource<T> {
  get: Mock<PushedSource<T>['get']>
  onChange: Mock<PushedSource<T>['onChange']>
  /** Resolves every `get()` still pending, as main answering. */
  answer(value: T): Promise<void>
  /** Calls every listener, as main pushing a change. */
  push(value: T): void
  readonly listeners: number
}

/** A source whose `get()` stays pending until the test answers, so pushes can land first. */
export function fakePushedSource<T>(): FakePushedSource<T> {
  const listeners = new Set<(value: T) => void>()
  // One promise per call, so a remount or a new source waits for an answer of its own.
  const pending: ((value: T) => void)[] = []
  return {
    get: vi.fn(() => new Promise<T>((resolve) => pending.push(resolve))),
    onChange: vi.fn((listener: (value: T) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    answer: async (value) => {
      // The hook sets state in a `.then`, so the act must wait out the promise's callbacks.
      await act(async () => {
        for (const resolve of pending.splice(0)) resolve(value)
      })
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
