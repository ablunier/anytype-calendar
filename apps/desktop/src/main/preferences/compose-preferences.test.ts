import { describe, expect, test } from 'vitest'
import { appConfigStore } from '../app-config-file'
import type { AtomicFile } from '../atomic-file'
import { composePreferences } from './compose-preferences'

function fakeFile(): AtomicFile {
  let bytes: Buffer | null = null
  return {
    read: async () => bytes,
    write: async (next) => {
      bytes = Buffer.from(next)
    },
    remove: async () => {
      bytes = null
    },
  }
}

function setup() {
  const config = appConfigStore(fakeFile())
  return { config, preferences: composePreferences(config) }
}

// The section names below are what users' app-config.json files already hold.
describe('composePreferences', () => {
  test('starts each preference at its initial value when nothing was saved', async () => {
    const { preferences } = setup()
    await preferences.theme.load()
    await preferences.language.load()
    await preferences.weekNumbers.load()
    await preferences.calendarVisibility.load()
    await preferences.weekStart.load()
    await preferences.calendarView.load()
    await preferences.timeFormat.load()
    await preferences.agendaDays.load()
    expect(preferences.theme.state.get()).toBeNull()
    expect(preferences.language.state.get()).toBeNull()
    expect(preferences.weekNumbers.state.get()).toBe(false)
    expect(preferences.calendarVisibility.state.get()).toEqual({ hidden: [], collapsed: false, collapsedSpaces: [] })
    expect(preferences.weekStart.state.get()).toBe(0)
    expect(preferences.calendarView.state.get()).toBe('month')
    expect(preferences.timeFormat.state.get()).toBe('24h')
    expect(preferences.agendaDays.state.get()).toBe(14)
  })

  test('saves each preference under its section', async () => {
    const { config, preferences } = setup()
    const visibility = { hidden: ['calendar'], collapsed: true, collapsedSpaces: ['space'] }
    await preferences.theme.save('dark')
    await preferences.language.save('es')
    await preferences.weekNumbers.save(true)
    await preferences.calendarVisibility.save(visibility)
    await preferences.weekStart.save(6)
    await preferences.calendarView.save('week')
    await preferences.timeFormat.save('12h')
    await preferences.agendaDays.save(28)
    expect(await config.readSection('theme')).toBe('dark')
    expect(await config.readSection('language')).toBe('es')
    expect(await config.readSection('weekNumbers')).toBe(true)
    expect(await config.readSection('calendarVisibility')).toEqual(visibility)
    expect(await config.readSection('weekStart')).toBe(6)
    expect(await config.readSection('calendarView')).toBe('week')
    expect(await config.readSection('timeFormat')).toBe('12h')
    expect(await config.readSection('agendaDays')).toBe(28)
  })

  test('reads an agenda length that is not one of the three as two weeks', async () => {
    const { config, preferences } = setup()
    await config.writeSection('agendaDays', 10)
    await preferences.agendaDays.load()
    expect(preferences.agendaDays.state.get()).toBe(14)
  })
})
