import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resolveLocale } from '@renderer/lib/locale'
import en from './locales/en.json'
import es from './locales/es.json'
import gl from './locales/gl.json'

// Computed synchronously, ahead of the persisted preference `useLocale` later corrects (a
// no-op if this already agrees), so the very first paint never flashes English on a
// Spanish/Galician OS.
const initialLocale = resolveLocale(null, navigator.languages)

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    gl: { translation: gl }
  },
  lng: initialLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

export default i18n
