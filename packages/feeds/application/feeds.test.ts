import { describe, expect, test, vi } from 'vitest'
import type {
  FeedsCache,
  FeedsCalendarParser,
  FeedsCopy,
  FeedsFetchResult,
  FeedsGateway,
  FeedsOccurrence,
  FeedsSubscription,
  FeedsSubscriptionRepository
} from '../domain'
import { AddFeedsSubscription } from './add-feeds-subscription'
import { EditFeedsSubscription } from './edit-feeds-subscription'
import { FeedsStore } from './feeds-store'
import { LoadFeeds } from './load-feeds'
import { RefreshFeeds } from './refresh-feeds'
import { RemoveFeedsSubscription } from './remove-feeds-subscription'
import { ReorderFeedsSubscriptions } from './reorder-feeds-subscriptions'
import { SaveFeedsSubscriptions } from './save-feeds-subscriptions'
import { ShowFeedsWindow } from './show-feeds-window'

const WINDOW = { start: 1_000, end: 2_000 }

/** A feed's text, here: its name and occurrences as JSON. Anything else is not a calendar. */
const feed = (occurrences: Partial<FeedsOccurrence>[], name: string | null = null): string =>
  JSON.stringify({
    name,
    occurrences: occurrences.map((fields, index) => ({
      id: `e${index}`,
      title: 'Event',
      start: 1_500,
      end: null,
      allDay: false,
      ...fields
    }))
  })

const parser: FeedsCalendarParser = {
  parse: (text) => {
    try {
      const { name, occurrences } = JSON.parse(text) as { name: string | null; occurrences: FeedsOccurrence[] }
      return {
        name,
        occurrencesIn: (window) =>
          occurrences.filter(({ start, end }) => start <= window.end && (end ?? start) >= window.start)
      }
    } catch {
      return null
    }
  }
}

const subscription = (id: string, fields: Partial<FeedsSubscription> = {}): FeedsSubscription => ({
  id,
  name: `Feed ${id}`,
  url: `https://example.com/${id}.ics`,
  colour: 'blue',
  ...fields
})

function setup({
  saved = [] as FeedsSubscription[],
  copies = {} as Record<string, FeedsCopy>,
  answers = {} as Record<string, FeedsFetchResult | Promise<FeedsFetchResult>>
} = {}) {
  let stored = saved
  const repository: FeedsSubscriptionRepository = {
    load: async () => stored,
    save: vi.fn(async (next: readonly FeedsSubscription[]) => {
      stored = [...next]
    })
  }
  const cached = new Map(Object.entries(copies))
  const cache: FeedsCache = {
    read: async (id) => cached.get(id) ?? null,
    write: async (id, copy) => {
      cached.set(id, copy)
    },
    remove: async (id) => {
      cached.delete(id)
    }
  }
  const gateway: FeedsGateway = {
    fetch: vi.fn(async (url: string) => (await answers[url]) ?? { ok: false, failure: 'unreachable' })
  }
  const store = new FeedsStore()
  const now = () => 9_000
  const save = new SaveFeedsSubscriptions({ repository, store })
  let ids = 0
  return {
    store,
    repository,
    stored: () => stored,
    cached,
    gateway,
    load: new LoadFeeds({ repository, cache, parser, store }),
    refresh: new RefreshFeeds({ gateway, parser, cache, store, now }),
    add: new AddFeedsSubscription({ gateway, parser, cache, store, save, newId: () => `new${++ids}`, now }),
    edit: new EditFeedsSubscription(save),
    remove: new RemoveFeedsSubscription({ save, cache }),
    reorder: new ReorderFeedsSubscriptions(save),
    show: new ShowFeedsWindow(store)
  }
}

describe('loading at launch', () => {
  test('restores the subscriptions with their cached copies, drawn in the window', async () => {
    const { store, load, show } = setup({
      saved: [subscription('a'), subscription('b')],
      copies: { a: { text: feed([{ title: 'Standup' }]), readAt: 500 } }
    })
    show.execute(WINDOW)
    await load.execute()
    const state = store.get()
    expect(state.subscriptions.map(({ id, host, status }) => ({ id, host, status }))).toEqual([
      { id: 'a', host: 'example.com', status: { readAt: 500, reading: false, error: null } },
      { id: 'b', host: 'example.com', status: { readAt: null, reading: false, error: null } }
    ])
    expect(state.events).toEqual([
      { id: 'e0', feedId: 'a', rank: 0, title: 'Standup', start: 1_500, end: null, allDay: false }
    ])
  })

  test('never publishes an address', async () => {
    const { store, load } = setup({ saved: [subscription('a', { url: 'https://example.com/private-secret.ics' })] })
    await load.execute()
    expect(JSON.stringify(store.get())).not.toContain('secret')
  })

  test('skips a copy that is no longer a calendar', async () => {
    const { store, load, show } = setup({
      saved: [subscription('a')],
      copies: { a: { text: 'garbage', readAt: 500 } }
    })
    show.execute(WINDOW)
    await load.execute()
    expect(store.get().events).toEqual([])
    expect(store.get().subscriptions[0]?.status.readAt).toBeNull()
  })
})

describe('moving the window', () => {
  test('expands what was read over the new window without reading it again', async () => {
    const { store, load, show, gateway } = setup({
      saved: [subscription('a')],
      copies: { a: { text: feed([{ id: 'early', start: 1_500 }, { id: 'late', start: 5_500 }]), readAt: 1 } }
    })
    await load.execute()
    show.execute(WINDOW)
    expect(store.get().events.map(({ id }) => id)).toEqual(['early'])
    show.execute({ start: 5_000, end: 6_000 })
    expect(store.get().events.map(({ id }) => id)).toEqual(['late'])
    expect(gateway.fetch).not.toHaveBeenCalled()
  })

  test('orders events starting together by the subscriptions’ order', async () => {
    const { store, load, show, reorder } = setup({
      saved: [subscription('a'), subscription('b')],
      copies: {
        a: { text: feed([{ title: 'Zebra' }]), readAt: 1 },
        b: { text: feed([{ title: 'Aardvark' }]), readAt: 1 }
      }
    })
    show.execute(WINDOW)
    await load.execute()
    expect(store.get().events.map(({ title }) => title)).toEqual(['Zebra', 'Aardvark'])
    await reorder.execute(['b', 'a'])
    expect(store.get().events.map(({ title }) => title)).toEqual(['Aardvark', 'Zebra'])
  })
})

describe('refreshing', () => {
  test('replaces the copy, and caches the new one', async () => {
    const { store, load, refresh, show, cached } = setup({
      saved: [subscription('a')],
      copies: { a: { text: feed([{ title: 'Old' }]), readAt: 1 } },
      answers: { 'https://example.com/a.ics': { ok: true, text: feed([{ title: 'New' }]) } }
    })
    show.execute(WINDOW)
    await load.execute()
    await refresh.execute()
    expect(store.get().events.map(({ title }) => title)).toEqual(['New'])
    expect(store.get().subscriptions[0]?.status).toEqual({ readAt: 9_000, reading: false, error: null })
    expect(cached.get('a')).toEqual({ text: feed([{ title: 'New' }]), readAt: 9_000 })
  })

  test('keeps the last good copy when a read fails, and says why', async () => {
    const { store, load, refresh, show } = setup({
      saved: [subscription('a'), subscription('b')],
      copies: { a: { text: feed([{ title: 'Kept' }]), readAt: 1 } },
      answers: {
        'https://example.com/a.ics': { ok: false, failure: 'http', status: 404 },
        'https://example.com/b.ics': { ok: true, text: '<html>Sign in</html>' }
      }
    })
    show.execute(WINDOW)
    await load.execute()
    await refresh.execute()
    expect(store.get().events.map(({ title }) => title)).toEqual(['Kept'])
    expect(store.get().subscriptions.map(({ status }) => status)).toEqual([
      { readAt: 1, reading: false, error: { failure: 'http', status: 404, at: 9_000 } },
      { readAt: null, reading: false, error: { failure: 'not-calendar', at: 9_000 } }
    ])
  })

  test('lets a fast feed land while a slow one is still being read', async () => {
    let answerSlow: (result: FeedsFetchResult) => void = () => undefined
    const { store, load, refresh, show } = setup({
      saved: [subscription('slow'), subscription('fast')],
      answers: {
        'https://example.com/slow.ics': new Promise((resolve) => (answerSlow = resolve)),
        'https://example.com/fast.ics': { ok: true, text: feed([{ title: 'Fast' }]) }
      }
    })
    show.execute(WINDOW)
    await load.execute()
    const refreshing = refresh.execute()
    await vi.waitFor(() => expect(store.get().events.map(({ title }) => title)).toEqual(['Fast']))
    expect(store.get().subscriptions[0]?.status.reading).toBe(true)
    answerSlow({ ok: true, text: feed([{ title: 'Slow', start: 1_200 }]) })
    await refreshing
    expect(store.get().events.map(({ title }) => title)).toEqual(['Slow', 'Fast'])
  })

  test('does not ask for a feed already being read', async () => {
    const { load, refresh, gateway } = setup({
      saved: [subscription('a')],
      answers: { 'https://example.com/a.ics': { ok: true, text: feed([]) } }
    })
    await load.execute()
    await Promise.all([refresh.execute(), refresh.execute(['a'])])
    expect(gateway.fetch).toHaveBeenCalledTimes(1)
  })

  test('drops what a subscription removed meanwhile read', async () => {
    let answer: (result: FeedsFetchResult) => void = () => undefined
    const { store, load, refresh, remove, show, cached } = setup({
      saved: [subscription('a')],
      answers: { 'https://example.com/a.ics': new Promise((resolve) => (answer = resolve)) }
    })
    show.execute(WINDOW)
    await load.execute()
    const refreshing = refresh.execute()
    await remove.execute('a')
    answer({ ok: true, text: feed([{}]) })
    await refreshing
    expect(store.get()).toEqual({ subscriptions: [], window: WINDOW, events: [] })
    expect(cached.has('a')).toBe(false)
  })
})

describe('adding a subscription', () => {
  test('reads it first, then saves it last, in a colour not yet taken', async () => {
    const { store, stored, load, add, show, cached } = setup({
      saved: [subscription('a', { colour: 'blue' })],
      answers: { 'https://example.com/new.ics': { ok: true, text: feed([{ title: 'Holiday' }]) } }
    })
    show.execute(WINDOW)
    await load.execute()
    await expect(add.execute({ url: 'webcal://example.com/new.ics', name: ' Holidays ' })).resolves.toEqual({
      ok: true,
      id: 'new1'
    })
    expect(stored()).toEqual([
      subscription('a', { colour: 'blue' }),
      { id: 'new1', name: 'Holidays', url: 'https://example.com/new.ics', colour: 'teal' }
    ])
    expect(store.get().events.map(({ title, feedId }) => ({ title, feedId }))).toEqual([
      { title: 'Holiday', feedId: 'new1' }
    ])
    expect(store.get().subscriptions[1]?.status).toEqual({ readAt: 9_000, reading: false, error: null })
    expect(cached.has('new1')).toBe(true)
  })

  test('takes the colour asked for', async () => {
    const { stored, add } = setup({ answers: { 'https://example.com/new.ics': { ok: true, text: feed([]) } } })
    await add.execute({ url: 'https://example.com/new.ics', name: 'New', colour: 'red' })
    expect(stored()[0]?.colour).toBe('red')
  })

  test('takes the name the feed gives itself, or else its host, when given none', async () => {
    const { stored, add } = setup({
      answers: {
        'https://example.com/named.ics': { ok: true, text: feed([], 'Team rota') },
        'https://example.com/bare.ics': { ok: true, text: feed([]) }
      }
    })
    await add.execute({ url: 'https://example.com/named.ics', name: '' })
    await add.execute({ url: 'https://example.com/bare.ics', name: '  ' })
    expect(stored().map(({ name }) => name)).toEqual(['Team rota', 'example.com'])
  })

  test.each([
    ['an address that is not one', { url: 'example.com/cal.ics', name: 'X' }, { ok: false, failure: 'invalid-url' }],
    ['a name too long', { url: 'https://example.com/ok.ics', name: 'x'.repeat(300) }, { ok: false, failure: 'invalid-name' }],
    ['one that does not answer', { url: 'https://example.com/down.ics', name: 'X' }, { ok: false, failure: 'unreachable' }],
    ['one that answers 404', { url: 'https://example.com/gone.ics', name: 'X' }, { ok: false, failure: 'http', status: 404 }],
    ['one that is not a calendar', { url: 'https://example.com/page', name: 'X' }, { ok: false, failure: 'not-calendar' }]
  ])('refuses %s, saving nothing', async (_, input, outcome) => {
    const { stored, add, repository } = setup({
      answers: {
        'https://example.com/ok.ics': { ok: true, text: feed([]) },
        'https://example.com/gone.ics': { ok: false, failure: 'http', status: 404 },
        'https://example.com/page': { ok: true, text: '<!doctype html>' }
      }
    })
    await expect(add.execute(input)).resolves.toEqual(outcome)
    expect(stored()).toEqual([])
    expect(repository.save).not.toHaveBeenCalled()
  })
})

describe('editing the subscriptions', () => {
  test('renames and recolours one, keeping the rest', async () => {
    const { stored, load, edit, store } = setup({ saved: [subscription('a'), subscription('b')] })
    await load.execute()
    await edit.execute({ id: 'b', name: 'Family', colour: 'pink' })
    expect(stored()).toEqual([subscription('a'), subscription('b', { name: 'Family', colour: 'pink' })])
    expect(store.get().subscriptions[1]).toMatchObject({ name: 'Family', colour: 'pink' })
  })

  test('removes one along with its cached copy', async () => {
    const { stored, load, remove, cached } = setup({
      saved: [subscription('a'), subscription('b')],
      copies: { a: { text: feed([]), readAt: 1 } }
    })
    await load.execute()
    await remove.execute('a')
    expect(stored()).toEqual([subscription('b')])
    expect(cached.has('a')).toBe(false)
  })

  test('reorders them only by a list naming each once', async () => {
    const { stored, load, reorder, repository } = setup({ saved: [subscription('a'), subscription('b'), subscription('c')] })
    await load.execute()
    await reorder.execute(['c', 'a', 'b'])
    expect(stored().map(({ id }) => id)).toEqual(['c', 'a', 'b'])
    await reorder.execute(['a', 'b'])
    await reorder.execute(['a', 'a', 'b'])
    await reorder.execute(['c', 'a', 'b'])
    expect(stored().map(({ id }) => id)).toEqual(['c', 'a', 'b'])
    expect(repository.save).toHaveBeenCalledTimes(1)
  })

  test('applies changes made together one over the other', async () => {
    const { stored, load, edit, add } = setup({
      saved: [subscription('a')],
      answers: { 'https://example.com/new.ics': { ok: true, text: feed([]) } }
    })
    await load.execute()
    await Promise.all([
      add.execute({ url: 'https://example.com/new.ics', name: 'New' }),
      edit.execute({ id: 'a', name: 'Renamed' })
    ])
    expect(stored().map(({ name }) => name)).toEqual(['Renamed', 'New'])
  })

  test('holds nothing new when the write fails', async () => {
    const { store, load, edit, repository } = setup({ saved: [subscription('a')] })
    await load.execute()
    vi.mocked(repository.save).mockRejectedValueOnce(new Error('EACCES'))
    await expect(edit.execute({ id: 'a', name: 'Renamed' })).rejects.toThrow('EACCES')
    expect(store.get().subscriptions[0]?.name).toBe('Feed a')
    await edit.execute({ id: 'a', name: 'Again' })
    expect(store.get().subscriptions[0]?.name).toBe('Again')
  })
})
