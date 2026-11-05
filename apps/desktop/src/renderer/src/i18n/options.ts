import type { InitOptions } from 'i18next'

/** What the app and the component tests initialise i18next with alike, so both render the same copy. */
export const i18nOptions = {
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
} satisfies InitOptions
