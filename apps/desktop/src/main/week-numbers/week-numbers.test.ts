import { describe, expect, test, vi } from 'vitest'
import { appConfigStore } from '../app-config-file'
import type { AtomicFile } from '../atomic-file'
import { LoadWeekNumbers } from './load-week-numbers'
import { SaveWeekNumbers } from './save-week-numbers'
import { toWeekNumbers, WeekNumbersStore } from './week-numbers-store'

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
  const store = new WeekNumbersStore()
  const listener = vi.fn()
  store.subscribe(listener)
  return {
    config,
    store,
    listener,
    load: new LoadWeekNumbers({ config, store }),
    save: new SaveWeekNumbers({ config, store })
  }
}

describe('toWeekNumbers', () => {
  test('accepts only booleans', () => {
    expect(toWeekNumbers(true)).toBe(true)
    expect(toWeekNumbers(false)).toBe(false)
    expect(toWeekNumbers('true')).toBeNull()
    expect(toWeekNumbers(undefined)).toBeNull()
  })
})

describe('LoadWeekNumbers', () => {
  test('is off when nothing was ever saved', async () => {
    const { store, load } = setup()
    await load.execute()
    expect(store.get()).toBe(false)
  })

  test('restores a saved preference', async () => {
    const { config, store, load } = setup()
    await config.writeSection('weekNumbers', true)
    await load.execute()
    expect(store.get()).toBe(true)
  })

  test('is off when the saved value is not a boolean', async () => {
    const { config, store, load } = setup()
    await config.writeSection('weekNumbers', 'yes')
    await load.execute()
    expect(store.get()).toBe(false)
  })
})

describe('SaveWeekNumbers', () => {
  test('writes the preference, then holds it', async () => {
    const { config, store, listener, save } = setup()
    await save.execute(true)
    expect(await config.readSection('weekNumbers')).toBe(true)
    expect(store.get()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('keeps the other sections untouched', async () => {
    const { config, save } = setup()
    await config.writeSection('theme', 'dark')
    await save.execute(true)
    expect(await config.readSection('theme')).toBe('dark')
  })
})
