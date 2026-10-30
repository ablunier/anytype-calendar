import { describe, expect, test, vi } from 'vitest'
import { appConfigStore } from '../app-config-file'
import type { AtomicFile } from '../atomic-file'
import { preference, PreferenceStore } from './preference'

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

type Colour = 'red' | 'blue'

const toColour = (value: unknown): Colour | undefined => (value === 'red' || value === 'blue' ? value : undefined)

function setup(initial: Colour = 'red') {
  const config = appConfigStore(fakeFile())
  const colour = preference({ config, section: 'colour', initial, parse: toColour })
  const listener = vi.fn()
  colour.state.subscribe(listener)
  return { config, colour, listener }
}

describe('PreferenceStore', () => {
  test('notifies no one when set to what it holds', () => {
    const store = new PreferenceStore('red')
    const listener = vi.fn()
    store.subscribe(listener)
    store.set('red')
    expect(listener).not.toHaveBeenCalled()
  })

  test('compares with the equality it is given', () => {
    const store = new PreferenceStore({ n: 1 }, (a, b) => a.n === b.n)
    const listener = vi.fn()
    store.subscribe(listener)
    store.set({ n: 1 })
    store.set({ n: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('preference', () => {
  test('loads the initial value when nothing was ever saved', async () => {
    const { colour } = setup('blue')
    await colour.load()
    expect(colour.state.get()).toBe('blue')
  })

  test('restores a saved value', async () => {
    const { config, colour } = setup()
    await config.writeSection('colour', 'blue')
    await colour.load()
    expect(colour.state.get()).toBe('blue')
  })

  test('loads the initial value when the saved one is not a value', async () => {
    const { config, colour } = setup()
    await colour.save('blue')
    await config.writeSection('colour', 'green')
    await colour.load()
    expect(colour.state.get()).toBe('red')
  })

  test('restores a saved null, when null is a value', async () => {
    const config = appConfigStore(fakeFile())
    const colour = preference<Colour | null>({
      config,
      section: 'colour',
      initial: 'red',
      parse: (value) => (value === null ? null : toColour(value))
    })
    await config.writeSection('colour', null)
    await colour.load()
    expect(colour.state.get()).toBeNull()
  })

  test('writes a value, then holds it', async () => {
    const { config, colour, listener } = setup()
    await colour.save('blue')
    expect(await config.readSection('colour')).toBe('blue')
    expect(colour.state.get()).toBe('blue')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('keeps the other sections untouched', async () => {
    const { config, colour } = setup()
    await config.writeSection('theme', 'dark')
    await colour.save('blue')
    expect(await config.readSection('theme')).toBe('dark')
  })
})
