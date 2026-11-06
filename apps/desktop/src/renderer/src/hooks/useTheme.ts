import { useEffect, useRef, useState } from 'react'
import { usePushedState } from './usePushedState'

export type Theme = 'light' | 'dark'

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Follows the OS setting until main reports a saved theme (or, on a later launch, from the
 * first render), then follows that instead. The design system keys its dark palette on
 * [data-theme="dark"], and the @theme mapping in tokens.css is non-inline, so flipping this
 * attribute re-points every utility at runtime — no re-render of styles, no class churn on
 * individual elements.
 */
export function useTheme(): [Theme, () => void] {
  const saved = usePushedState(window.api.theme)
  const [theme, setTheme] = useState<Theme>(systemTheme)

  useEffect(() => {
    if (saved) setTheme(saved)
  }, [saved])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  /* Flips the latest theme set, not the last one drawn, so two toggles before a render both
   * count; and saves outside a state updater, which React may run twice (StrictMode). */
  const latest = useRef(theme)
  latest.current = theme
  const toggleTheme = (): void => {
    const next = latest.current === 'dark' ? 'light' : 'dark'
    latest.current = next
    setTheme(next)
    void window.api.theme.save(next)
  }

  return [theme, toggleTheme]
}
