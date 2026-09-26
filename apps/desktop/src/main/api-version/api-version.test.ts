import { describe, expect, test, vi } from 'vitest'
import { appConfigStore } from '../app-config-file'
import type { AtomicFile } from '../atomic-file'
import { ApiVersionStore, toApiVersion } from './api-version-store'
import { LoadApiVersion } from './load-api-version'
import { SaveApiVersion } from './save-api-version'

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
  const store = new ApiVersionStore()
  const listener = vi.fn()
  store.subscribe(listener)
  return {
    config,
    store,
    listener,
    load: new LoadApiVersion({ config, store }),
    save: new SaveApiVersion({ config, store })
  }
}

describe('toApiVersion', () => {
  test('accepts only auto and v1', () => {
    expect(toApiVersion('auto')).toBe('auto')
    expect(toApiVersion('v1')).toBe('v1')
    expect(toApiVersion('v2')).toBeNull()
    expect(toApiVersion(null)).toBeNull()
  })
})

describe('LoadApiVersion', () => {
  test('is automatic when nothing was ever saved', async () => {
    const { store, load } = setup()
    await load.execute()
    expect(store.get()).toBe('auto')
  })

  test('restores a saved preference', async () => {
    const { config, store, load } = setup()
    await config.writeSection('apiVersion', 'v1')
    await load.execute()
    expect(store.get()).toBe('v1')
  })

  test('is automatic when the saved value is not a preference', async () => {
    const { config, store, load } = setup()
    await config.writeSection('apiVersion', 'v3')
    await load.execute()
    expect(store.get()).toBe('auto')
  })
})

describe('SaveApiVersion', () => {
  test('writes the preference, then holds it', async () => {
    const { config, store, listener, save } = setup()
    await save.execute('v1')
    expect(await config.readSection('apiVersion')).toBe('v1')
    expect(store.get()).toBe('v1')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
