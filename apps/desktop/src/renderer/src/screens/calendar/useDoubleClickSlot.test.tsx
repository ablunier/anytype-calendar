import { renderHook } from '@testing-library/react'
import type { MouseEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useDoubleClickSlot } from './useDoubleClickSlot'

// A .tsx file, though it holds no JSX: only the components project has the DOM a hook renders in.
const click = (detail: number, timeStamp: number) =>
  ({ detail, timeStamp, preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as MouseEvent

function setup() {
  const onCreate = vi.fn()
  const { result } = renderHook(() => useDoubleClickSlot<string>(onCreate))
  return { onCreate, slot: () => result.current }
}

describe('useDoubleClickSlot', () => {
  it('creates at the first press within a second of it, and stops the double-click', () => {
    const { onCreate, slot } = setup()
    slot().press(click(1, 0), 'pressed')
    const doubleClick = click(2, 1000)
    slot().capture.onDoubleClickCapture(doubleClick)
    expect(onCreate).toHaveBeenCalledExactlyOnceWith('pressed')
    expect(doubleClick.stopPropagation).toHaveBeenCalled()
  })

  it('lets the double-click through once the press is over a second old', () => {
    const { onCreate, slot } = setup()
    slot().press(click(1, 0), 'pressed')
    const doubleClick = click(2, 1001)
    slot().capture.onDoubleClickCapture(doubleClick)
    expect(onCreate).not.toHaveBeenCalled()
    expect(doubleClick.stopPropagation).not.toHaveBeenCalled()
  })

  it('takes a press only once', () => {
    const { onCreate, slot } = setup()
    slot().press(click(1, 0), 'pressed')
    slot().capture.onDoubleClickCapture(click(2, 100))
    slot().capture.onDoubleClickCapture(click(2, 200))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('keeps the first press when the second is pressed too', () => {
    const { onCreate, slot } = setup()
    slot().press(click(1, 0), 'pressed')
    slot().press(click(2, 100), 'landed')
    slot().capture.onDoubleClickCapture(click(2, 100))
    expect(onCreate).toHaveBeenCalledExactlyOnceWith('pressed')
  })

  it('forgets the press when a later first press does not reach the slot', () => {
    const { onCreate, slot } = setup()
    slot().press(click(1, 0), 'pressed')
    slot().capture.onClickCapture(click(1, 100))
    slot().capture.onDoubleClickCapture(click(2, 200))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('holds back only the second press of a recent double-click', () => {
    const { slot } = setup()
    const early = click(2, 0)
    slot().capture.onClickCapture(early)
    slot().capture.onMouseDownCapture(early)
    expect(early.stopPropagation).not.toHaveBeenCalled()
    expect(early.preventDefault).not.toHaveBeenCalled()

    slot().press(click(1, 0), 'pressed')
    const second = click(2, 100)
    slot().capture.onMouseDownCapture(second)
    slot().capture.onClickCapture(second)
    expect(second.preventDefault).toHaveBeenCalled()
    expect(second.stopPropagation).toHaveBeenCalled()

    const late = click(2, 1001)
    slot().capture.onClickCapture(late)
    expect(late.stopPropagation).not.toHaveBeenCalled()
  })
})
