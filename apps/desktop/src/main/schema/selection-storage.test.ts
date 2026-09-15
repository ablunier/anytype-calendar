import { describe, expect, test } from 'vitest'
import { appConfigStore } from '../app-config-file'
import type { AtomicFile } from '../atomic-file'
import { selectionFileAt } from './selection-storage'

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

describe('selectionFileAt', () => {
  test('reads null when nothing was ever saved', async () => {
    const file = selectionFileAt(appConfigStore(fakeFile()))
    expect(await file.read()).toBeNull()
  })

  test('reads back what was written', async () => {
    const file = selectionFileAt(appConfigStore(fakeFile()))
    await file.write('{"version":2,"selection":{"spaceIds":[]}}')
    expect(await file.read()).toBe('{"version":2,"selection":{"spaceIds":[]}}')
  })

  test('keeps the theme section untouched', async () => {
    const config = appConfigStore(fakeFile())
    await config.writeSection('theme', 'dark')
    const file = selectionFileAt(config)
    await file.write('{"version":2,"selection":{"spaceIds":["sp_1"]}}')
    expect(await config.readSection('theme')).toBe('dark')
  })
})
