import { fakePushedSource } from '@renderer/test/pushed-source'
import type { ThemeSnapshot } from '@shared/ipc'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTheme } from './useTheme'

/** Stubs only what the hook reads: the OS theme `matchMedia` reports, and `window.api.theme`. */
function stubTheme(os: 'light' | 'dark') {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && os === 'dark',
    media: query,
  }))
  const source = fakePushedSource<ThemeSnapshot>()
  const save = vi.fn(async (_theme: 'light' | 'dark') => {})
  vi.stubGlobal('api', { theme: { ...source, save } })
  return { source, save }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useTheme', () => {
  it.each(['light', 'dark'] as const)('starts from the OS theme, here %s', (os) => {
    stubTheme(os)
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe(os)
  })

  it('keeps following the OS when no theme was ever saved', async () => {
    const { source } = stubTheme('dark')
    const { result } = renderHook(() => useTheme())
    await source.answer(null)
    expect(result.current[0]).toBe('dark')
  })

  it('switches to the saved theme when it arrives', async () => {
    const { source } = stubTheme('light')
    const { result } = renderHook(() => useTheme())
    await source.answer('dark')
    expect(result.current[0]).toBe('dark')
  })

  it('writes the theme to the document', async () => {
    const { source } = stubTheme('light')
    renderHook(() => useTheme())
    const html = document.documentElement
    expect(html).toHaveAttribute('data-theme', 'light')
    expect(html.style.colorScheme).toBe('light')
    await source.answer('dark')
    expect(html).toHaveAttribute('data-theme', 'dark')
    expect(html.style.colorScheme).toBe('dark')
  })

  it('flips on toggle and saves the new theme', () => {
    const { save } = stubTheme('light')
    const { result } = renderHook(() => useTheme())
    act(() => result.current[1]())
    expect(result.current[0]).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(save).toHaveBeenLastCalledWith('dark')
    act(() => result.current[1]())
    expect(result.current[0]).toBe('light')
    expect(save).toHaveBeenLastCalledWith('light')
  })

  it('counts two toggles made before a render', () => {
    const { save } = stubTheme('light')
    const { result } = renderHook(() => useTheme())
    act(() => {
      const [, toggle] = result.current
      toggle()
      toggle()
    })
    expect(result.current[0]).toBe('light')
    expect(save.mock.calls).toEqual([['dark'], ['light']])
  })
})
