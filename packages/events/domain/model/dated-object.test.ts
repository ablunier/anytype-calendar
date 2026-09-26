import { describe, expect, test } from 'vitest'
import {
  compareEventsDatedObjects,
  overlapsEventsWindow,
  toEventsDatedObject,
  type EventsDatedObject
} from './dated-object'
import type { EventsSource } from './source'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

const ALL_DAY_SOURCE: EventsSource = {
  spaceId: 'sp_1',
  typeKey: 'project',
  from: 'start_date',
  to: 'due_date',
  includesTime: false
}
const TIMED_SOURCE: EventsSource = { ...ALL_DAY_SOURCE, includesTime: true }

describe('toEventsDatedObject', () => {
  test("carries the ref's id, title and dates, and the source's space and type", () => {
    const start = 1_000
    const end = 2_000
    expect(toEventsDatedObject({ id: 'obj_1', title: 'Launch', start, end }, ALL_DAY_SOURCE)).toEqual({
      id: 'obj_1',
      spaceId: 'sp_1',
      typeKey: 'project',
      title: 'Launch',
      start,
      end,
      allDay: true
    })
  })

  test('carries whether it is done, and its location', () => {
    const ref = { id: 'o', title: '', start: 1, end: null, done: true, location: 'Room 4' }
    expect(toEventsDatedObject(ref, ALL_DAY_SOURCE)).toMatchObject({ done: true, location: 'Room 4' })
  })

  test('leaves out an empty location', () => {
    const ref = { id: 'o', title: '', start: 1, end: null, location: '' }
    expect(toEventsDatedObject(ref, ALL_DAY_SOURCE)).not.toHaveProperty('location')
  })

  test("colours it by its option's colour", () => {
    const source: EventsSource = {
      ...ALL_DAY_SOURCE,
      colourBy: { key: 'priority', options: [{ name: 'P1', color: 'red' }] }
    }
    const ref = (option: string) => ({ id: 'o', title: '', start: 1, end: null, option })
    expect(toEventsDatedObject(ref('P1'), source).colour).toBe('red')
    expect(toEventsDatedObject(ref('Gone'), source)).not.toHaveProperty('colour')
    expect(toEventsDatedObject(ref('P1'), ALL_DAY_SOURCE)).not.toHaveProperty('colour')
  })

  test('reads all-day from a source with no time, regardless of the instant', () => {
    const start = Date.parse('2026-09-08T14:20:39Z')
    const object = toEventsDatedObject({ id: 'o', title: '', start, end: null }, ALL_DAY_SOURCE)
    expect(object.allDay).toBe(true)
  })

  test('reads timed from a source with a time, regardless of the instant', () => {
    const start = Date.parse('2026-09-13T22:00:00Z')
    const object = toEventsDatedObject({ id: 'o', title: '', start, end: null }, TIMED_SOURCE)
    expect(object.allDay).toBe(false)
  })

  test('drops an end before the start, keeping the object on its start', () => {
    const start = 10_000
    const object = toEventsDatedObject(
      { id: 'o', title: '', start, end: start - DAY_MS },
      ALL_DAY_SOURCE
    )
    expect(object).toMatchObject({ start, end: null, allDay: true })
  })

  test('keeps an end equal to the start', () => {
    const start = 10_000 + 9 * HOUR_MS
    const object = toEventsDatedObject({ id: 'o', title: '', start, end: start }, TIMED_SOURCE)
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
      ALL_DAY_SOURCE
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
