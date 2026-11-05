import en from '@renderer/i18n/locales/en.json'
import { type RenderOptions, type RenderResult, render } from '@testing-library/react'
import { type UserEvent, userEvent } from '@testing-library/user-event'
import { createInstance } from 'i18next'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'

const i18n = createInstance()
// Initialised synchronously: the resources are inline, so no test waits on a backend.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
})

function I18nWrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

/**
 * Renders on the `en` locale, so queries can use the visible copy, with a user to drive it.
 * `rerender` keeps the locale.
 */
export function renderWithI18n(ui: ReactElement): RenderResult & { user: UserEvent } {
  // Typed without `queries`, so the overload that binds the default ones is the one picked.
  const options: Omit<RenderOptions, 'queries'> = { wrapper: I18nWrapper }
  return { user: userEvent.setup(), ...render(ui, options) }
}
