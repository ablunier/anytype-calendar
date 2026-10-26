import { expect, test } from 'vitest'
import { FileFeedsCache, type FeedsCacheDirectory } from './file-feeds-cache'

function setup(files: Record<string, string> = {}) {
  const stored = new Map(Object.entries(files))
  const directory: FeedsCacheDirectory = {
    read: async (name) => stored.get(name) ?? null,
    write: async (name, text) => {
      stored.set(name, text)
    },
    remove: async (name) => {
      stored.delete(name)
    }
  }
  return { cache: new FileFeedsCache(directory), stored }
}

test('returns the copy written, from a file named by the feed', async () => {
  const { cache, stored } = setup()
  await cache.write('a1', { text: 'BEGIN:VCALENDAR', readAt: 42 })
  await expect(cache.read('a1')).resolves.toEqual({ text: 'BEGIN:VCALENDAR', readAt: 42 })
  expect([...stored.keys()]).toEqual(['a1.json'])
})

test('holds nothing once removed, or before anything was written', async () => {
  const { cache } = setup()
  await cache.write('a1', { text: 'x', readAt: 1 })
  await cache.remove('a1')
  await expect(cache.read('a1')).resolves.toBeNull()
  await expect(cache.read('b2')).resolves.toBeNull()
})

test.each([
  ['not JSON', 'BEGIN:VCALENDAR'],
  ['no text', '{"readAt":1}'],
  ['no time', '{"text":"x"}']
])('a file holding %s reads as no copy', async (_, text) => {
  await expect(setup({ 'a1.json': text }).cache.read('a1')).resolves.toBeNull()
})

test('refuses an id that could name a file elsewhere', async () => {
  const { cache } = setup()
  await expect(cache.write('../credential', { text: 'x', readAt: 1 })).rejects.toThrow(TypeError)
  await expect(cache.read('../credential')).resolves.toBeNull()
})
