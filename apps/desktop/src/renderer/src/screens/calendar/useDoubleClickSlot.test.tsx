import { renderHook } from '@testing-library/react'
import type { MouseEvent } from 'react'
import { describe, expect, it } from 'vitest'
import { useDoubleClickSlot } from './useDoubleClickSlot'

// A .tsx file, though it holds no JSX: only the components project has the DOM a hook renders in.
const click = (detail: number, timeStamp: number) => ({ detail, timeStamp }) as MouseEvent

describe('useDoubleClickSlot', () => {
  it('takes the first press within a second of it', () => {
    const { result } = renderHook(() => useDoubleClickSlot<string>())
    result.current.press(click(1, 0), 'pressed')
    expect(result.current.take(click(2, 1000), 'landed')).toBe('pressed')
  })

  it('takes its own slot once the press is over a second old', () => {
    const { result } = renderHook(() => useDoubleClickSlot<string>())
    result.current.press(click(1, 0), 'pressed')
    expect(result.current.take(click(2, 1001), 'landed')).toBe('landed')
  })

  it('takes a press only once', () => {
    const { result } = renderHook(() => useDoubleClickSlot<string>())
    result.current.press(click(1, 0), 'pressed')
    result.current.take(click(2, 100), 'landed')
    expect(result.current.take(click(2, 200), 'again')).toBe('again')
  })

  it('keeps the first press when the second is pressed too', () => {
    const { result } = renderHook(() => useDoubleClickSlot<string>())
    result.current.press(click(1, 0), 'pressed')
    result.current.press(click(2, 100), 'landed')
    expect(result.current.take(click(2, 100), 'landed')).toBe('pressed')
  })

  it('says a click continues a press only when it is a recent second press', () => {
    const { result } = renderHook(() => useDoubleClickSlot<string>())
    expect(result.current.continues(click(2, 0))).toBe(false)
    result.current.press(click(1, 0), 'pressed')
    expect(result.current.continues(click(1, 100))).toBe(false)
    expect(result.current.continues(click(2, 100))).toBe(true)
    expect(result.current.continues(click(2, 1001))).toBe(false)
  })
})
