import { describe, expect, test } from 'vitest'
import type { CalendarEvent, ObjectType, TypePicks } from '@renderer/types'
import {
  allHidden,
  prunedHidden,
  sourcesOnCalendar,
  visibilityOf,
  visibleEvents,
  withVisibility
} from './visibility'

const event = (id: string, type: string, rank: number, date = '2026-09-03'): CalendarEvent => ({
  id,
  title: id,
  type,
  space: 'sp_1',
  rank,
  date,
  allDay: true,
  details: []
})

const TASK = 'sp_1:task'
const OPEN = 'sp_1:query:q_open'

describe('visibleEvents', () => {
  const events = [event('a', TASK, 0), event('b', OPEN, 1)]

  test('keeps everything when nothing is hidden', () => {
    expect(visibleEvents(events, new Set())).toEqual(events)
  })

  test("drops a hidden source's events", () => {
    expect(visibleEvents(events, new Set([TASK]))).toEqual([events[1]])
    expect(visibleEvents(events, new Set([TASK, OPEN]))).toEqual([])
  })

  test('draws an object a type and a query both bring once, as the type places it', () => {
    const asType = event('shared', TASK, 0, '2026-09-20')
    const asQuery = event('shared', OPEN, 1, '2026-09-03')
    expect(visibleEvents([asQuery, asType], new Set())).toEqual([asType])
  })

  test("draws it as the query places it once the type is hidden", () => {
    const asType = event('shared', TASK, 0, '2026-09-20')
    const asQuery = event('shared', OPEN, 1, '2026-09-03')
    expect(visibleEvents([asQuery, asType], new Set([TASK]))).toEqual([asQuery])
  })

  test('keeps the order it was given', () => {
    const early = event('early', OPEN, 1, '2026-09-01')
    const late = event('late', TASK, 0, '2026-09-09')
    expect(visibleEvents([early, late], new Set())).toEqual([early, late])
  })

  test('picks the lower-ranked of two queries', () => {
    const first = event('shared', 'sp_1:query:q_a', 1)
    const second = event('shared', 'sp_1:query:q_b', 2)
    expect(visibleEvents([second, first], new Set())).toEqual([first])
    expect(visibleEvents([second, first], new Set(['sp_1:query:q_a']))).toEqual([second])
  })

  test('tells apart equal ids in different spaces', () => {
    const other = { ...event('same', TASK, 0), space: 'sp_2' }
    expect(visibleEvents([event('same', TASK, 0), other], new Set())).toHaveLength(2)
  })
})

describe('visibilityOf', () => {
  test('is shown, hidden or mixed by how many of the keys are hidden', () => {
    expect(visibilityOf(['a', 'b'], new Set())).toBe('shown')
    expect(visibilityOf(['a', 'b'], new Set(['a']))).toBe('mixed')
    expect(visibilityOf(['a', 'b'], new Set(['a', 'b', 'c']))).toBe('hidden')
  })

  test('counts a space with no sources as shown', () => {
    expect(visibilityOf([], new Set(['a']))).toBe('shown')
  })
})

describe('withVisibility', () => {
  test('hides or shows the keys together, leaving the rest as it was', () => {
    expect(withVisibility(new Set(['x']), ['a', 'b'], false).sort()).toEqual(['a', 'b', 'x'])
    expect(withVisibility(new Set(['x', 'a']), ['a', 'b'], true)).toEqual(['x'])
  })
})

describe('prunedHidden', () => {
  test('drops keys that are no longer sources', () => {
    expect(prunedHidden(['a', 'gone', 'b'], ['a', 'b', 'c'])).toEqual(['a', 'b'])
  })
})

describe('sourcesOnCalendar and allHidden', () => {
  const type = (key: string, space: string, query = false): ObjectType =>
    ({ key, space, ...(query ? { query: { typeLabel: '', views: [] } } : {}) }) as ObjectType
  const types = [type(TASK, 'sp_1'), type(OPEN, 'sp_1', true), type('sp_1:note', 'sp_1'), type('sp_2:task', 'sp_2')]
  const picks: TypePicks = { spaceKeys: ['sp_1'], typeKeys: [TASK, OPEN, 'sp_2:task'], dates: {} }

  test('are the chosen types and queries of chosen spaces', () => {
    expect(sourcesOnCalendar(types, picks).map(({ key }) => key)).toEqual([TASK, OPEN])
  })

  test('says everything is hidden only when there is something to hide', () => {
    const sources = sourcesOnCalendar(types, picks)
    expect(allHidden(sources, new Set([TASK, OPEN]))).toBe(true)
    expect(allHidden(sources, new Set([TASK]))).toBe(false)
    expect(allHidden([], new Set())).toBe(false)
  })
})
