import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

/**
 * The active theme, written to <html data-theme> so the token layer can re-resolve.
 *
 * The design system keys its dark palette on [data-theme="dark"], and the @theme mapping
 * in tokens.css is non-inline, so flipping this attribute re-points every utility at
 * runtime — no re-render of styles, no class churn on individual elements.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  return [theme, () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))]
}
