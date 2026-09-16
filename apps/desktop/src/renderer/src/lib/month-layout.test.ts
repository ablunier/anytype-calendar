import { describe, expect, test } from 'vitest'
import type { CalendarEvent } from '@renderer/types'
import { buildMonthGrid } from './calendar'
import { layOutWeek, MAX_LANES, type EventSegment } from './month-layout'

/* September 2026 starts on a Tuesday, so the first row borrows 31 August and the last runs
 * into October — both edges a range can be cut at. */
const WEEKS = ((grid) => {
  const weeks = []
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7))
  return weeks
})(buildMonthGrid(2026, 8))

const [FIRST_WEEK, SECOND_WEEK] = WEEKS
const LAST_WEEK = WEEKS[WEEKS.length - 1]

const event = (id: string, date: string, until?: string): CalendarEvent => ({
  id,
  title: id,
  type: 'sp_1:task',
  space: 'sp_1',
  date,
  allDay: true,
  ...(until === undefined ? {} : { until })
})

const shape = ({
  event: { id },
  column,
  span,
  lane,
  continuesBefore,
  continuesAfter
}: EventSegment): object => ({ id, column, span, lane, continuesBefore, continuesAfter })

describe('layOutWeek', () => {
  test('draws a single day as one closed column', () => {
    // 3 September 2026 is a Thursday: column 3 of the week that starts on Monday 31 August.
    const { segments, lanes, hidden } = layOutWeek([event('a', '2026-09-03')], FIRST_WEEK)
    expect(segments.map(shape)).toEqual([
      { id: 'a', column: 3, span: 1, lane: 0, continuesBefore: false, continuesAfter: false }
    ])
    expect(lanes).toBe(1)
    expect(hidden).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  test('draws a range inside one week as one bar closed at both ends', () => {
    const { segments } = layOutWeek([event('a', '2026-09-08', '2026-09-10')], SECOND_WEEK)
    expect(segments.map(shape)).toEqual([
      { id: 'a', column: 1, span: 3, lane: 0, continuesBefore: false, continuesAfter: false }
    ])
  })

  test('cuts a range at the week boundary it crosses', () => {
    const range = event('a', '2026-09-04', '2026-09-08')
    expect(layOutWeek([range], FIRST_WEEK).segments.map(shape)).toEqual([
      { id: 'a', column: 4, span: 3, lane: 0, continuesBefore: false, continuesAfter: true }
    ])
    expect(layOutWeek([range], SECOND_WEEK).segments.map(shape)).toEqual([
      { id: 'a', column: 0, span: 2, lane: 0, continuesBefore: true, continuesAfter: false }
    ])
  })

  test('cuts a range at the month edges, where the days are outside', () => {
    // The first row borrows 31 August; the last runs to 4 October.
    const fromAugust = event('a', '2026-08-28', '2026-09-02')
    expect(layOutWeek([fromAugust], FIRST_WEEK).segments.map(shape)).toEqual([
      { id: 'a', column: 1, span: 2, lane: 0, continuesBefore: true, continuesAfter: false }
    ])

    const intoOctober = event('b', '2026-09-29', '2026-10-06')
    expect(layOutWeek([intoOctober], LAST_WEEK).segments.map(shape)).toEqual([
      { id: 'b', column: 1, span: 2, lane: 0, continuesBefore: false, continuesAfter: true }
    ])
  })

  test('leaves out an event the week does not reach', () => {
    expect(layOutWeek([event('a', '2026-09-20')], SECOND_WEEK)).toEqual({
      segments: [],
      lanes: 0,
      hidden: [0, 0, 0, 0, 0, 0, 0]
    })
  })

  test('gives overlapping events a lane each, and keeps a bar in one lane all week', () => {
    const { segments, lanes } = layOutWeek(
      [
        event('short', '2026-09-09'),
        event('long', '2026-09-07', '2026-09-11'),
        event('later', '2026-09-10', '2026-09-13')
      ],
      SECOND_WEEK
    )
    expect(segments.map(shape)).toEqual([
      // The longer bar takes the top lane; the two below it share the next, not overlapping.
      { id: 'long', column: 0, span: 5, lane: 0, continuesBefore: false, continuesAfter: false },
      { id: 'short', column: 2, span: 1, lane: 1, continuesBefore: false, continuesAfter: false },
      { id: 'later', column: 3, span: 4, lane: 1, continuesBefore: false, continuesAfter: false }
    ])
    expect(lanes).toBe(2)
  })

  test('drops what will not fit and counts it on each of its own days only', () => {
    const events = [
      event('a', '2026-09-07', '2026-09-13'),
      event('b', '2026-09-07', '2026-09-13'),
      event('c', '2026-09-07', '2026-09-13'),
      event('d', '2026-09-09', '2026-09-10'),
      event('e', '2026-09-09')
    ]
    const { segments, lanes, hidden } = layOutWeek(events, SECOND_WEEK)

    expect(segments.map(({ event: { id } }) => id)).toEqual(['a', 'b', 'c'])
    expect(lanes).toBe(MAX_LANES)
    expect(hidden).toEqual([0, 0, 2, 1, 0, 0, 0])
  })
})
