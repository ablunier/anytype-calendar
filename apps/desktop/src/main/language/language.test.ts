import { describe, expect, test, vi } from 'vitest'
import { appConfigStore } from '../app-config-file'
import type { AtomicFile } from '../atomic-file'
import { LoadLanguage } from './load-language'
import { SaveLanguage } from './save-language'
import { LanguageStore, toLanguage } from './language-store'

function fakeFile(): AtomicFile {
  let bytes: Buffer | null = null
  return {
    read: async () => bytes,
    write: async (next) => {
      bytes = Buffer.from(next)
    },
    remove: async () => {
      bytes = null
    }
  }
}

function setup() {
  const config = appConfigStore(fakeFile())
  const store = new LanguageStore()
  const listener = vi.fn()
  store.subscribe(listener)
  return {
    config,
    store,
    listener,
    load: new LoadLanguage({ config, store }),
    save: new SaveLanguage({ config, store })
  }
}

describe('toLanguage', () => {
  test('accepts a supported language', () => {
    expect(toLanguage('en')).toBe('en')
    expect(toLanguage('es')).toBe('es')
    expect(toLanguage('gl')).toBe('gl')
  })

  test('accepts an explicit null as "follow the OS"', () => {
    expect(toLanguage(null)).toBeNull()
  })

  test('is undefined for anything else', () => {
    expect(toLanguage('fr')).toBeUndefined()
    expect(toLanguage(undefined)).toBeUndefined()
    expect(toLanguage(1)).toBeUndefined()
  })
})

describe('LoadLanguage', () => {
  test('is null when no language was ever saved', async () => {
    const { store, load } = setup()
    await load.execute()
    expect(store.get()).toBeNull()
  })

  test('restores a saved language', async () => {
    const { config, store, load } = setup()
    await config.writeSection('language', 'gl')
    await load.execute()
    expect(store.get()).toBe('gl')
  })

  test('falls back to null when the saved value is not a language', async () => {
    const { config, store, load } = setup()
    await config.writeSection('language', 'fr')
    await load.execute()
    expect(store.get()).toBeNull()
  })
})

describe('SaveLanguage', () => {
  test('writes the language, then holds it', async () => {
    const { config, store, listener, save } = setup()
    await save.execute('es')
    expect(await config.readSection('language')).toBe('es')
    expect(store.get()).toBe('es')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('round-trips null, resetting to "follow the OS"', async () => {
    const { config, store, save } = setup()
    await save.execute('es')
    await save.execute(null)
    expect(await config.readSection('language')).toBeNull()
    expect(store.get()).toBeNull()
  })

  test('keeps other sections untouched', async () => {
    const { config, save } = setup()
    await config.writeSection('theme', 'dark')
    await save.execute('gl')
    expect(await config.readSection('theme')).toBe('dark')
  })
})
