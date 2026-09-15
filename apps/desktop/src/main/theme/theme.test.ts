import { describe, expect, test, vi } from 'vitest'
import { appConfigStore } from '../app-config-file'
import type { AtomicFile } from '../atomic-file'
import { LoadTheme } from './load-theme'
import { SaveTheme } from './save-theme'
import { ThemeStore } from './theme-store'

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
  const store = new ThemeStore()
  const listener = vi.fn()
  store.subscribe(listener)
  return { config, store, listener, load: new LoadTheme({ config, store }), save: new SaveTheme({ config, store }) }
}

describe('LoadTheme', () => {
  test('is null when no theme was ever saved', async () => {
    const { store, load } = setup()
    await load.execute()
    expect(store.get()).toBeNull()
  })

  test('restores a saved theme', async () => {
    const { config, store, load } = setup()
    await config.writeSection('theme', 'dark')
    await load.execute()
    expect(store.get()).toBe('dark')
  })

  test('is null when the saved value is not a theme', async () => {
    const { config, store, load } = setup()
    await config.writeSection('theme', 'blue')
    await load.execute()
    expect(store.get()).toBeNull()
  })
})

describe('SaveTheme', () => {
  test('writes the theme, then holds it', async () => {
    const { config, store, listener, save } = setup()
    await save.execute('dark')
    expect(await config.readSection('theme')).toBe('dark')
    expect(store.get()).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('keeps the schema selection section untouched', async () => {
    const { config, save } = setup()
    await config.writeSection('schemaSelection', { spaceIds: ['sp_1'] })
    await save.execute('light')
    expect(await config.readSection('schemaSelection')).toEqual({ spaceIds: ['sp_1'] })
  })
})
