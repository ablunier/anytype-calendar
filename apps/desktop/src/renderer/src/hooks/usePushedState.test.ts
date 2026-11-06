import { fakePushedSource } from '@renderer/test/pushed-source'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePushedState } from './usePushedState'

describe('usePushedState', () => {
  it('is undefined until main first answers, then holds the answer', async () => {
    const source = fakePushedSource<string>()
    const { result } = renderHook(() => usePushedState(source))
    expect(result.current).toBeUndefined()
    await source.answer('answered')
    expect(result.current).toBe('answered')
  })

  it('subscribes before it asks', () => {
    const source = fakePushedSource<string>()
    renderHook(() => usePushedState(source))
    const [subscribed] = source.onChange.mock.invocationCallOrder
    const [asked] = source.get.mock.invocationCallOrder
    expect(subscribed).toBeLessThan(asked)
  })

  it('keeps a push that lands before the answer over the answer', async () => {
    const source = fakePushedSource<string>()
    const { result } = renderHook(() => usePushedState(source))
    source.push('pushed')
    await source.answer('stale')
    expect(result.current).toBe('pushed')
  })

  it('follows later pushes', async () => {
    const source = fakePushedSource<string>()
    const { result } = renderHook(() => usePushedState(source))
    await source.answer('first')
    source.push('second')
    expect(result.current).toBe('second')
    source.push('third')
    expect(result.current).toBe('third')
  })

  it('unsubscribes on unmount and ignores an answer that arrives afterwards', async () => {
    const source = fakePushedSource<string>()
    const { result, unmount } = renderHook(() => usePushedState(source))
    expect(source.listeners).toBe(1)
    unmount()
    expect(source.listeners).toBe(0)
    await source.answer('late')
    expect(result.current).toBeUndefined()
  })
})
