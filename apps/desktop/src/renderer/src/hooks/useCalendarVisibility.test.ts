import { fakePushedSource } from '@renderer/test/pushed-source'
import type { CalendarVisibilitySnapshot } from '@shared/ipc'
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCalendarVisibility } from './useCalendarVisibility'

function stubVisibility() {
  const source = fakePushedSource<CalendarVisibilitySnapshot>()
  const save = vi.fn(async (_visibility: CalendarVisibilitySnapshot) => {})
  vi.stubGlobal('api', { calendarVisibility: { ...source, save } })
  return { source, save }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCalendarVisibility', () => {
  it('shows everything, with the sidebar open, until main answers', () => {
    stubVisibility()
    const { result } = renderHook(() => useCalendarVisibility())
    expect(result.current[0]).toEqual({ hidden: [], collapsed: false, collapsedSpaces: [] })
  })

  it('builds each update on the one saved before it, though main has not pushed either', () => {
    const { save } = stubVisibility()
    const { result } = renderHook(() => useCalendarVisibility())
    const [, update] = result.current
    update((current) => ({ ...current, hidden: [...current.hidden, 'sp_1:task'] }))
    update((current) => ({ ...current, collapsed: !current.collapsed }))
    expect(save.mock.calls).toEqual([
      [{ hidden: ['sp_1:task'], collapsed: false, collapsedSpaces: [] }],
      [{ hidden: ['sp_1:task'], collapsed: true, collapsedSpaces: [] }],
    ])
  })

  it('takes a pushed value in place of the one it had', async () => {
    const { source } = stubVisibility()
    const { result } = renderHook(() => useCalendarVisibility())
    await source.answer({ hidden: ['sp_1:task'], collapsed: false, collapsedSpaces: [] })
    const pushed = { hidden: [], collapsed: true, collapsedSpaces: ['sp_2'] }
    source.push(pushed)
    expect(result.current[0]).toEqual(pushed)
  })
})
