import { describe, expect, test } from 'vitest'
import type { CalendarEvent } from '@renderer/types'
import { layOutDayColumn, MINUTES_PER_DAY, MIN_SLOT_MINUTES, splitDayEvents } from './time-grid'

const DAY = '2026-09-23'

function timed(id: string, time: string, end?: string, until?: string): CalendarEvent {
  return {
    id,
    title: id,
    type: 'sp_1:task',
    space: 'sp_1',
    date: DAY,
    time,
    allDay: false,
    ...(end === undefined ? {} : { end }),
    ...(until === undefined ? {} : { until })
  }
}

const columnsOf = (segments: ReturnType<typeof layOutDayColumn>): Record<string, number[]> =>
  Object.fromEntries(segments.map((s) => [s.event.id, [s.column, s.columns]]))

describe('splitDayEvents', () => {
  test('keeps only what covers the day', () => {
    const other = { ...timed('elsewhere', '09:00', '10:00'), date: '2026-09-24', until: '2026-09-24' }
    const { timed: kept } = splitDayEvents([timed('today', '09:00', '10:00'), other], DAY)
    expect(kept.map((e) => e.id)).toEqual(['today'])
  })

  test('sends all-day objects to the band', () => {
    const allDay: CalendarEvent = {
      id: 'holiday',
      title: 'holiday',
      type: 'sp_1:task',
      space: 'sp_1',
      date: DAY,
      allDay: true
    }
    const { band, timed: kept } = splitDayEvents([allDay], DAY)
    expect(band.map((e) => e.id)).toEqual(['holiday'])
    expect(kept).toEqual([])
  })

  test('sends a range crossing midnight to the band, on both of its days', () => {
    const trip = timed('trip', '18:00', '11:00', '2026-09-24')
    expect(splitDayEvents([trip], DAY).band.map((e) => e.id)).toEqual(['trip'])
    expect(splitDayEvents([trip], '2026-09-24').band.map((e) => e.id)).toEqual(['trip'])
  })

  test('sends a timed object with no time to the band, having nowhere to sit', () => {
    const { band } = splitDayEvents([{ ...timed('vague', '09:00'), time: undefined }], DAY)
    expect(band.map((e) => e.id)).toEqual(['vague'])
  })
})

describe('layOutDayColumn', () => {
  test('places an object over the minutes it covers', () => {
    const [segment] = layOutDayColumn([timed('a', '09:30', '11:00')])
    expect(segment).toMatchObject({ startMinute: 570, endMinute: 660, column: 0, columns: 1 })
  })

  test('gives objects that do not overlap the same column', () => {
    const segments = layOutDayColumn(
      [timed('a', '09:00', '10:00'), timed('b', '11:00', '12:00')])
    expect(columnsOf(segments)).toEqual({ a: [0, 1], b: [0, 1] })
  })

  test('touching at an edge is not overlapping', () => {
    const segments = layOutDayColumn(
      [timed('a', '09:00', '10:00'), timed('b', '10:00', '11:00')])
    expect(columnsOf(segments)).toEqual({ a: [0, 1], b: [0, 1] })
  })

  test('splits the width between two that overlap', () => {
    const segments = layOutDayColumn(
      [timed('a', '09:00', '10:30'), timed('b', '10:00', '11:00')])
    expect(columnsOf(segments)).toEqual({ a: [0, 2], b: [1, 2] })
  })

  test('sizes a whole run together, so a bar keeps one width throughout', () => {
    // a overlaps b and b overlaps c, so all three are one run and share its width — even
    // though c, clear of a, takes the column a left free rather than a third one.
    const segments = layOutDayColumn(
      [timed('a', '09:00', '10:00'), timed('b', '09:30', '11:00'), timed('c', '10:30', '11:30')])
    expect(columnsOf(segments)).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2] })
  })

  test('widens a run to hold everything open at once', () => {
    const segments = layOutDayColumn(
      [timed('a', '09:00', '12:00'), timed('b', '09:30', '12:00'), timed('c', '10:00', '12:00')])
    expect(columnsOf(segments)).toEqual({ a: [0, 3], b: [1, 3], c: [2, 3] })
  })

  test('reuses a column freed earlier in the run', () => {
    const segments = layOutDayColumn(
      [timed('long', '09:00', '13:00'), timed('a', '09:30', '10:00'), timed('b', '10:30', '11:00')])
    expect(columnsOf(segments)).toEqual({ long: [0, 2], a: [1, 2], b: [1, 2] })
  })

  test('starts a fresh run once nothing is left open', () => {
    const segments = layOutDayColumn(
      [timed('a', '09:00', '10:30'), timed('b', '10:00', '11:00'), timed('c', '14:00', '15:00')])
    expect(columnsOf(segments)).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] })
  })

  test('gives a zero-length object a readable height', () => {
    const [segment] = layOutDayColumn([timed('a', '09:00', '09:00')])
    expect(segment?.endMinute).toBe(540 + MIN_SLOT_MINUTES)
  })

  test('draws an object with no end as a moment, not a run to midnight', () => {
    const [segment] = layOutDayColumn([timed('a', '09:00')])
    expect(segment).toMatchObject({ startMinute: 540, endMinute: 540 + MIN_SLOT_MINUTES })
  })

  test('never runs past midnight, even for a slot that would not fit', () => {
    const [segment] = layOutDayColumn([timed('a', '23:50', '23:55')])
    expect(segment?.endMinute).toBe(MINUTES_PER_DAY)
  })

  test('is stable for objects that start and end together', () => {
    const order = (ids: string[]): string[] =>
      layOutDayColumn(ids.map((id) => timed(id, '09:00', '10:00'))).map((s) => s.event.id)
    expect(order(['b', 'a'])).toEqual(order(['a', 'b']))
  })
})
