import en from '@renderer/i18n/locales/en.json'
import es from '@renderer/i18n/locales/es.json'
import gl from '@renderer/i18n/locales/gl.json'
import { i18nOptions } from '@renderer/i18n/options'
import { createInstance } from 'i18next'
import { describe, expect, test } from 'vitest'
import { feedFailureText } from './feed-text'

const i18n = createInstance()
void i18n.init({
  resources: { en: { translation: en }, es: { translation: es }, gl: { translation: gl } },
  lng: 'en',
  ...i18nOptions,
  initAsync: false,
})

describe('feedFailureText', () => {
  test.each(['en', 'es', 'gl'])('names the subscription that already has the address, in %s', (lng) => {
    const text = feedFailureText(i18n.getFixedT(lng), { failure: 'duplicate', name: 'Work' })
    expect(text).toContain('Work')
    expect(text).not.toContain('feeds.failure')
  })
})
