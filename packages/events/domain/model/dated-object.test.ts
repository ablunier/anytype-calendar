import { describe, expect, test } from 'vitest'
import type { EventsTimeZone } from '../gateways/time-zone'
import {
  compareEventsDatedObjects,
  overlapsEventsWindow,
  toEventsDatedObject,
  type EventsDatedObject
} from './dated-object'
import type { EventsSource } from './source'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

/** Two hours ahead of UTC, so a local midnight is 22:00 UTC the day before. */
const PLUS_TWO: EventsTimeZone = {
  startOfDay: ({ year, month, day }) => Date.UTC(year, month, day) - 2 * HOUR_MS,
  dayOf: (instant) => {
    const date = new Date(instant + 2 * HOUR_MS)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() }
  }
}

const SOURCE: EventsSource = { spaceId: 'sp_1', typeKey: 'project', from: 'start_date', to: 'due_date' }

const midnight = (month: number, day: number): number => PLUS_TWO.startOfDay({ year: 2026, month, day })

describe('toEventsDatedObject', () => {
  test("carries the ref's id, title and dates, and the source's space and type", () => {
    const start = midnight(8, 14)
    const end = midnight(8, 16)
    expect(toEventsDatedObject({ id: 'obj_1', title: 'Launch', start, end }, SOURCE, PLUS_TWO)).toEqual({
      id: 'obj_1',
      spaceId: 'sp_1',
      typeKey: 'project',
      title: 'Launch',
      start,
      end,
      allDay: true
    })
  })

  test('reads a date on the first instant of a local day as all-day', () => {
    // How Anytype stores 14 September with no time, set two hours ahead of UTC.
    const start = Date.parse('2026-09-13T22:00:00Z')
    const object = toEventsDatedObject({ id: 'o', title: '', start, end: null }, SOURCE, PLUS_TWO)
    expect(object.allDay).toBe(true)
  })

  test('reads any other instant as timed', () => {
    const start = Date.parse('2026-09-08T14:20:39Z')
    const object = toEventsDatedObject({ id: 'o', title: '', start, end: null }, SOURCE, PLUS_TWO)
    expect(object.allDay).toBe(false)
  })

  test('is timed when only the end has a time', () => {
    const object = toEventsDatedObject(
      { id: 'o', title: '', start: midnight(8, 14), end: midnight(8, 14) + 11 * HOUR_MS },
      SOURCE,
      PLUS_TWO
    )
    expect(object.allDay).toBe(false)
  })

  test('drops an end before the start, keeping the object on its start', () => {
    const start = midnight(8, 14)
    const object = toEventsDatedObject(
      { id: 'o', title: '', start, end: start - DAY_MS },
      SOURCE,
      PLUS_TWO
    )
    expect(object).toMatchObject({ start, end: null, allDay: true })
  })

  test('keeps an end equal to the start', () => {
    const start = midnight(8, 14) + 9 * HOUR_MS
    const object = toEventsDatedObject({ id: 'o', title: '', start, end: start }, SOURCE, PLUS_TWO)
    expect(object).toMatchObject({ start, end: start, allDay: false })
  })
})

describe('overlapsEventsWindow', () => {
  const window = { start: 1_000, end: 2_000 }

  test.each([
    ['starts inside', { start: 1_500, end: null }, true],
    ['starts on the first instant', { start: 1_000, end: null }, true],
    ['starts on the last instant', { start: 2_000, end: null }, true],
    ['starts before, with no end', { start: 999, end: null }, false],
    ['starts after', { start: 2_001, end: null }, false],
    ['a range ending on the first instant', { start: 500, end: 1_000 }, true],
    ['a range ending just before', { start: 500, end: 999 }, false],
    ['a range starting on the last instant', { start: 2_000, end: 3_000 }, true],
    ['a range spanning the whole window', { start: 0, end: 5_000 }, true],
    ['a range inside', { start: 1_200, end: 1_800 }, true],
    ['a range wholly after', { start: 2_001, end: 3_000 }, false]
  ])('%s', (_, object, expected) => {
    expect(overlapsEventsWindow(object, window)).toBe(expected)
  })

  test('an object whose end was dropped overlaps by its start alone', () => {
    const object = toEventsDatedObject(
      { id: 'o', title: '', start: 2_500, end: 1_500 },
      SOURCE,
      PLUS_TWO
    )
    expect(overlapsEventsWindow(object, window)).toBe(false)
  })
})

describe('compareEventsDatedObjects', () => {
  const object = (id: string, title: string, start: number): EventsDatedObject => ({
    id,
    spaceId: 'sp_1',
    typeKey: 'task',
    title,
    start,
    end: null,
    allDay: false
  })

  test('orders by start, then title, then id', () => {
    const sorted = [
      object('c', 'Beta', 2),
      object('b', 'Alpha', 2),
      object('z', 'Zed', 1),
      object('a', 'Alpha', 2)
    ].sort(compareEventsDatedObjects)
    expect(sorted.map(({ id }) => id)).toEqual(['z', 'a', 'b', 'c'])
  })
})
