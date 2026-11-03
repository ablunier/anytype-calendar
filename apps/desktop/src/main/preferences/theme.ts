export type Theme = 'light' | 'dark'

/** Null: no theme was ever saved, so the renderer follows the OS setting. */
export type ThemeState = Theme | null

/** Only a theme: `null` is what a missing one loads as, never a value to save. */
export function toTheme(value: unknown): Theme | undefined {
  return value === 'light' || value === 'dark' ? value : undefined
}
