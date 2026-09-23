import { describe, expect, test, vi } from 'vitest'
import { appConfigStore } from '../app-config-file'
import type { AtomicFile } from '../atomic-file'
import { CalendarViewStore, toCalendarView } from './calendar-view-store'
import { LoadCalendarView } from './load-calendar-view'
import { SaveCalendarView } from './save-calendar-view'

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
  const store = new CalendarViewStore()
  const listener = vi.fn()
  store.subscribe(listener)
  return {
    config,
    store,
    listener,
    load: new LoadCalendarView({ config, store }),
    save: new SaveCalendarView({ config, store })
  }
}

describe('toCalendarView', () => {
  test('accepts only the three views', () => {
    expect(toCalendarView('month')).toBe('month')
    expect(toCalendarView('week')).toBe('week')
    expect(toCalendarView('day')).toBe('day')
    expect(toCalendarView('year')).toBeNull()
    expect(toCalendarView('Month')).toBeNull()
    expect(toCalendarView(0)).toBeNull()
    expect(toCalendarView(undefined)).toBeNull()
  })
})

describe('LoadCalendarView', () => {
  test('is the month when nothing was ever saved', async () => {
    const { store, load } = setup()
    await load.execute()
    expect(store.get()).toBe('month')
  })

  test('restores a saved view', async () => {
    const { config, store, load } = setup()
    await config.writeSection('calendarView', 'week')
    await load.execute()
    expect(store.get()).toBe('week')
  })

  test('is the month when the saved value is not a view', async () => {
    const { config, store, load } = setup()
    await config.writeSection('calendarView', 'fortnight')
    await load.execute()
    expect(store.get()).toBe('month')
  })
})

describe('SaveCalendarView', () => {
  test('writes the view, then holds it', async () => {
    const { config, store, listener, save } = setup()
    await save.execute('day')
    expect(await config.readSection('calendarView')).toBe('day')
    expect(store.get()).toBe('day')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('keeps the other sections untouched', async () => {
    const { config, save } = setup()
    await config.writeSection('theme', 'dark')
    await save.execute('week')
    expect(await config.readSection('theme')).toBe('dark')
  })
})
