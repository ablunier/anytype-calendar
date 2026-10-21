import { describe, expect, test, vi } from 'vitest'
import { appConfigStore } from '../app-config-file'
import type { AtomicFile } from '../atomic-file'
import { CalendarVisibilityStore, toCalendarVisibility } from './calendar-visibility-store'
import { LoadCalendarVisibility } from './load-calendar-visibility'
import { SaveCalendarVisibility } from './save-calendar-visibility'

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
  const store = new CalendarVisibilityStore()
  const listener = vi.fn()
  store.subscribe(listener)
  return {
    config,
    store,
    listener,
    load: new LoadCalendarVisibility({ config, store }),
    save: new SaveCalendarVisibility({ config, store })
  }
}

describe('toCalendarVisibility', () => {
  test('reads hidden keys and the collapsed flag', () => {
    expect(toCalendarVisibility({ hidden: ['a', 'b'], collapsed: true, collapsedSpaces: ['sp_1'] })).toEqual({
      hidden: ['a', 'b'],
      collapsed: true,
      collapsedSpaces: ['sp_1']
    })
  })

  test('keeps a repeated key once, and drops what is not a key', () => {
    expect(toCalendarVisibility({ hidden: ['a', 'a', 3, '', null, 'b'], collapsed: false })).toEqual({
      hidden: ['a', 'b'],
      collapsed: false,
      collapsedSpaces: []
    })
  })

  test('defaults a field that is malformed without discarding the other', () => {
    expect(toCalendarVisibility({ hidden: 'a', collapsed: true })).toEqual({ hidden: [], collapsed: true, collapsedSpaces: [] })
    expect(toCalendarVisibility({ hidden: ['a'], collapsed: 'yes' })).toEqual({
      hidden: ['a'],
      collapsed: false,
      collapsedSpaces: []
    })
  })

  test('refuses what is not an object', () => {
    expect(toCalendarVisibility(null)).toBeNull()
    expect(toCalendarVisibility(true)).toBeNull()
    expect(toCalendarVisibility('hidden')).toBeNull()
  })
})

describe('CalendarVisibilityStore', () => {
  test('notifies no one when set to what it holds', () => {
    const { store, listener } = setup()
    store.set({ hidden: ['a'], collapsed: false, collapsedSpaces: [] })
    store.set({ hidden: ['a'], collapsed: false, collapsedSpaces: [] })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('LoadCalendarVisibility', () => {
  test('shows everything, expanded, when nothing was ever saved', async () => {
    const { store, load } = setup()
    await load.execute()
    expect(store.get()).toEqual({ hidden: [], collapsed: false, collapsedSpaces: [] })
  })

  test('restores what was saved', async () => {
    const { config, store, load } = setup()
    await config.writeSection('calendarVisibility', { hidden: ['sp_1\ttask'], collapsed: true, collapsedSpaces: ['sp_2'] })
    await load.execute()
    expect(store.get()).toEqual({ hidden: ['sp_1\ttask'], collapsed: true, collapsedSpaces: ['sp_2'] })
  })

  test('shows everything when the saved value is not an object', async () => {
    const { config, store, load } = setup()
    await config.writeSection('calendarVisibility', 'nothing')
    await load.execute()
    expect(store.get()).toEqual({ hidden: [], collapsed: false, collapsedSpaces: [] })
  })
})

describe('SaveCalendarVisibility', () => {
  test('writes the visibility, then holds it', async () => {
    const { config, store, listener, save } = setup()
    await save.execute({ hidden: ['a'], collapsed: true, collapsedSpaces: ['sp_1'] })
    expect(await config.readSection('calendarVisibility')).toEqual({ hidden: ['a'], collapsed: true, collapsedSpaces: ['sp_1'] })
    expect(store.get()).toEqual({ hidden: ['a'], collapsed: true, collapsedSpaces: ['sp_1'] })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('keeps the other sections untouched', async () => {
    const { config, save } = setup()
    await config.writeSection('weekNumbers', true)
    await save.execute({ hidden: [], collapsed: true, collapsedSpaces: [] })
    expect(await config.readSection('weekNumbers')).toBe(true)
  })
})
