import type { LanguageSnapshot } from '@shared/ipc'

export type Locale = 'en' | 'es' | 'gl'

const LOCALES: readonly Locale[] = ['en', 'es', 'gl']

const DEFAULT_LOCALE: Locale = 'en'

/**
 * `preference` is what was saved in Settings; `null` (nothing saved, or "System default")
 * falls back to the first of `systemLocales` (`navigator.languages`, most preferred first)
 * that matches one of the three shipped locales, by primary subtag (`es-MX` matches `es`).
 * `'en'` when nothing matches either.
 */
export function resolveLocale(preference: LanguageSnapshot, systemLocales: readonly string[]): Locale {
  if (preference !== null) return preference
  for (const tag of systemLocales) {
    const primary = tag.split('-')[0]?.toLowerCase()
    const match = LOCALES.find((locale) => locale === primary)
    if (match) return match
  }
  return DEFAULT_LOCALE
}
