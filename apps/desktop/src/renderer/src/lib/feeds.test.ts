import { describe, expect, test } from 'vitest'
import type { FeedsSnapshot } from '@shared/ipc'
import type { CalendarEvent } from '@renderer/types'
import { feedEventsFor, feedsFor, feedSourceKey, mergedEvents, movedOrder } from './feeds'

const at = (date: string, time = '00:00'): number => new Date(`${date}T${time}`).getTime()

const snapshot: FeedsSnapshot = {
  subscriptions: [
    {
      id: 'a1',
      name: 'Holidays',
      colour: 'teal',
      host: 'calendar.google.com',
      status: { readAt: at('2026-09-10', '11:00'), reading: false, error: null }
    },
    {
      id: 'b2',
      name: 'Team',
      colour: 'purple',
      host: 'example.com',
      status: { readAt: null, reading: false, error: { failure: 'http', status: 404, at: at('2026-09-10', '12:00') } }
    }
  ],
  window: { start: at('2026-08-25'), end: at('2026-10-08') - 1 },
  events: [
    { id: 'h1', feedId: 'a1', rank: 0, title: 'Holiday', start: at('2026-09-11'), end: null, allDay: true },
    {
      id: 'm1#1',
      feedId: 'b2',
      rank: 1,
      title: 'Sync',
      start: at('2026-09-14', '10:00'),
      end: at('2026-09-14', '11:30'),
      allDay: false,
      location: 'Room 2',
      description: 'Notes',
      url: 'https://example.com/sync'
    },
    { id: 'gone', feedId: 'zz', rank: 2, title: 'Orphan', start: at('2026-09-14'), end: null, allDay: true }
  ]
}

describe('feedsFor', () => {
  test('lists the subscriptions in order, each with its hue and how its last read went', () => {
    expect(feedsFor(snapshot, at('2026-09-10', '11:05'))).toEqual([
      {
        key: 'feed:a1',
        id: 'a1',
        name: 'Holidays',
        category: 'teal',
        colour: 'teal',
        host: 'calendar.google.com',
        status: { state: 'synced', elapsed: { key: 'minutesAgo', count: 5 } }
      },
      {
        key: 'feed:b2',
        id: 'b2',
        name: 'Team',
        category: 'plum',
        colour: 'purple',
        host: 'example.com',
        status: { state: 'error', failure: { failure: 'http', status: 404 } }
      }
    ])
  })

  test('says a feed never read yet is offline, and one being read is syncing', () => {
    const unread: FeedsSnapshot = {
      ...snapshot,
      subscriptions: [
        { ...snapshot.subscriptions[0]!, status: { readAt: null, reading: false, error: null } },
        { ...snapshot.subscriptions[1]!, status: { readAt: null, reading: true, error: null } }
      ]
    }
    expect(feedsFor(unread, 0).map(({ status }) => status.state)).toEqual(['offline', 'syncing'])
  })
})

describe('feedEventsFor', () => {
  test('turns each event into a read-only CalendarEvent in its subscription’s hue', () => {
    expect(feedEventsFor(snapshot)).toEqual([
      {
        id: 'feed:a1:h1',
        title: 'Holiday',
        type: feedSourceKey('a1'),
        space: feedSourceKey('a1'),
        rank: 0,
        date: '2026-09-11',
        allDay: true,
        category: 'teal',
        feed: { calendar: 'Holidays' }
      },
      {
        id: 'feed:b2:m1#1',
        title: 'Sync',
        type: 'feed:b2',
        space: 'feed:b2',
        rank: 1,
        date: '2026-09-14',
        time: '10:00',
        until: '2026-09-14',
        end: '11:30',
        allDay: false,
        location: 'Room 2',
        category: 'plum',
        feed: { calendar: 'Team', description: 'Notes', url: 'https://example.com/sync' }
      }
    ])
  })
})

describe('mergedEvents', () => {
  const event = (id: string, date: string, time?: string): CalendarEvent => ({
    id,
    title: id,
    type: 't',
    space: 's',
    rank: 0,
    date,
    allDay: time === undefined,
    ...(time === undefined ? {} : { time })
  })

  test('orders both by day, all-day first, then by time, Anytype’s first when they tie', () => {
    const anytype = [event('a-allday', '2026-09-14'), event('a-9', '2026-09-14', '09:00'), event('a-next', '2026-09-15', '08:00')]
    const feeds = [event('f-earlier', '2026-09-13', '18:00'), event('f-allday', '2026-09-14'), event('f-9', '2026-09-14', '09:00'), event('f-8', '2026-09-14', '08:00')]
    expect(mergedEvents(anytype, feeds).map(({ id }) => id)).toEqual([
      'f-earlier',
      'a-allday',
      'f-allday',
      'f-8',
      'a-9',
      'f-9',
      'a-next'
    ])
  })

  test('returns Anytype’s list itself when there are no feeds', () => {
    const anytype = [event('a', '2026-09-14')]
    expect(mergedEvents(anytype, [])).toBe(anytype)
  })
})

describe('movedOrder', () => {
  test('moves one id, the others keeping their order', () => {
    expect(movedOrder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(movedOrder(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(movedOrder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  test('clamps a move past either end, and ignores an index that is not there', () => {
    expect(movedOrder(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(movedOrder(['a', 'b', 'c'], 0, 9)).toEqual(['b', 'c', 'a'])
    expect(movedOrder(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })
})
