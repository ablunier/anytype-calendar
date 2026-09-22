import { useEffect } from 'react'
import i18n from '@renderer/i18n'
import { resolveLocale, type Locale } from '@renderer/lib/locale'
import type { LanguageSnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

/**
 * Follows the OS language until main reports a saved one (or, on a later launch, from the
 * first render), then follows that instead — the same shape as `useTheme`. `saved` (the raw
 * preference, including `null` for "System default") is exposed alongside the resolved
 * `Locale` so Settings can tell the two apart.
 */
export function useLocale(): [Locale, LanguageSnapshot, (next: LanguageSnapshot) => void] {
  const saved = usePushedState(window.api.language) ?? null
  const locale = resolveLocale(saved, navigator.languages)

  useEffect(() => {
    void i18n.changeLanguage(locale)
  }, [locale])

  const setLanguage = (next: LanguageSnapshot): void => {
    void window.api.language.save(next)
  }

  return [locale, saved, setLanguage]
}
