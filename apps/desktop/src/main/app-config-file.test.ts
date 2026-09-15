import { describe, expect, test } from 'vitest'
import { appConfigStore } from './app-config-file'
import type { AtomicFile } from './atomic-file'

function fakeFile(initial: Record<string, unknown> | null = null): AtomicFile {
  let bytes = initial ? Buffer.from(JSON.stringify(initial)) : null
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

describe('appConfigStore', () => {
  test('reads a section back as null when nothing was ever saved', async () => {
    const store = appConfigStore(fakeFile())
    expect(await store.readSection('theme')).toBeNull()
  })

  test('writes a section, then reads it back', async () => {
    const store = appConfigStore(fakeFile())
    await store.writeSection('theme', 'dark')
    expect(await store.readSection('theme')).toBe('dark')
  })

  test('keeps other sections when writing one', async () => {
    const store = appConfigStore(fakeFile({ schemaSelection: { spaceIds: ['sp_1'] } }))
    await store.writeSection('theme', 'dark')
    expect(await store.readSection('schemaSelection')).toEqual({ spaceIds: ['sp_1'] })
    expect(await store.readSection('theme')).toBe('dark')
  })

  test('treats an unreadable file as an empty document', async () => {
    const file = fakeFile()
    const corrupt: AtomicFile = { ...file, read: async () => Buffer.from('not json') }
    const store = appConfigStore(corrupt)
    expect(await store.readSection('theme')).toBeNull()
  })

  test('serializes a write after a read so neither is lost', async () => {
    const store = appConfigStore(fakeFile())
    await Promise.all([store.writeSection('theme', 'dark'), store.writeSection('schemaSelection', { a: 1 })])
    expect(await store.readSection('theme')).toBe('dark')
    expect(await store.readSection('schemaSelection')).toEqual({ a: 1 })
  })
})
