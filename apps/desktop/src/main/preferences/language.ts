export type Language = 'en' | 'es' | 'gl'

/** Null: no language was chosen, so the renderer follows the OS language. */
export type LanguageState = Language | null

const LANGUAGES: readonly Language[] = ['en', 'es', 'gl']

/** Unlike `toTheme`, `null` is a value here: saving it is how "System default" is chosen again. */
export function toLanguage(value: unknown): LanguageState | undefined {
  if (value === null) return null
  return LANGUAGES.includes(value as Language) ? (value as Language) : undefined
}
