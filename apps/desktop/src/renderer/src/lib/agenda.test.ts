import type { CalendarEvent } from '@renderer/types'
import { describe, expect, test } from 'vitest'
import { buildAgenda } from './agenda'

// A Wednesday; the agenda runs to Tuesday 3 November.
const START = '2026-10-21'
const NOON = 12 * 60

const event = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
  id: overrides.title ?? 'obj',
  title: 'Untitled',
  type: 'sp:task',
  space: 'sp',
  rank: 0,
  date: START,
  allDay: true,
  details: [],
  ...overrides,
})

const titles = (events: CalendarEvent[], today = START, nowMinute = NOON): [string, string[]][] =>
  buildAgenda(events, START, today, nowMinute).map(({ date, rows }) => [date, rows.map((row) => row.event.title)])

describe('buildAgenda', () => {
  test('lists only the days that hold something, over fourteen days from the start', () => {
    const events = [
      event({ title: 'Before', date: '2026-10-20' }),
      event({ title: 'First', date: '2026-10-21' }),
      event({ title: 'Later', date: '2026-10-28' }),
      event({ title: 'Last', date: '2026-11-03' }),
      event({ title: 'After', date: '2026-11-04' }),
    ]
    expect(titles(events, '2026-12-01')).toEqual([
      ['2026-10-21', ['First']],
      ['2026-10-28', ['Later']],
      ['2026-11-03', ['Last']],
    ])
  })

  test('keeps today, empty, when the agenda covers it', () => {
    const days = buildAgenda([event({ title: 'Later', date: '2026-10-28' })], START, '2026-10-23', NOON)
    expect(days.map(({ date, isToday, rows }) => [date, isToday, rows.length])).toEqual([
      ['2026-10-23', true, 0],
      ['2026-10-28', false, 1],
    ])
    expect(days[0]?.nowBefore).toBeNull()
  })

  test('is empty when nothing falls in it and today is elsewhere', () => {
    expect(buildAgenda([], START, '2026-12-01', NOON)).toEqual([])
  })

  test('orders a day all-day first, then by start time, then by name', () => {
    const events = [
      event({ title: 'Late', allDay: false, time: '16:00' }),
      event({ title: 'Beta', allDay: false, time: '09:00' }),
      event({ title: 'Holiday' }),
      event({ title: 'Alpha', allDay: false, time: '09:00' }),
      event({ title: 'Birthday' }),
    ]
    expect(titles(events)).toEqual([[START, ['Birthday', 'Holiday', 'Alpha', 'Beta', 'Late']]])
  })

  test("shows a timed object's start and its end the same day", () => {
    const [day] = buildAgenda(
      [
        event({ title: 'Call', allDay: false, time: '10:30', until: START, end: '11:00' }),
        event({ title: 'Reminder', allDay: false, time: '15:00' }),
      ],
      START,
      '2026-12-01',
      NOON,
    )
    expect(day?.rows.map(({ time, range }) => [time, range])).toEqual([
      [{ kind: 'at', start: '10:30', end: '11:00' }, undefined],
      [{ kind: 'at', start: '15:00' }, undefined],
    ])
  })

  test('lists a timed range on each day it covers, with its day count and time', () => {
    const trip = event({
      title: 'Trip',
      allDay: false,
      date: '2026-10-22',
      time: '18:00',
      until: '2026-10-24',
      end: '11:00',
    })
    const days = buildAgenda([trip], START, '2026-12-01', NOON)
    expect(days.map(({ date, rows }) => [date, rows[0]?.time, rows[0]?.range])).toEqual([
      ['2026-10-22', { kind: 'at', start: '18:00' }, { day: 1, of: 3 }],
      ['2026-10-23', { kind: 'all-day' }, { day: 2, of: 3 }],
      ['2026-10-24', { kind: 'until', end: '11:00' }, { day: 3, of: 3 }],
    ])
  })

  test('reads an all-day range as all day on each of its days', () => {
    const days = buildAgenda([event({ title: 'Fair', until: '2026-10-22' })], START, '2026-12-01', NOON)
    expect(days.map(({ rows }) => [rows[0]?.time, rows[0]?.range])).toEqual([
      [{ kind: 'all-day' }, { day: 1, of: 2 }],
      [{ kind: 'all-day' }, { day: 2, of: 2 }],
    ])
  })

  test("counts a range's days from its own start and to its own end, past the agenda's edges", () => {
    const before = event({
      title: 'Before',
      allDay: false,
      date: '2026-10-19',
      time: '09:00',
      until: '2026-10-22',
      end: '10:00',
    })
    const after = event({
      title: 'After',
      allDay: false,
      date: '2026-11-02',
      time: '20:00',
      until: '2026-11-05',
      end: '08:00',
    })
    const days = buildAgenda([before, after], START, '2026-12-01', NOON)
    expect(days.map(({ date, rows }) => [date, rows[0]?.time, rows[0]?.range])).toEqual([
      ['2026-10-21', { kind: 'all-day' }, { day: 3, of: 4 }],
      ['2026-10-22', { kind: 'until', end: '10:00' }, { day: 4, of: 4 }],
      ['2026-11-02', { kind: 'at', start: '20:00' }, { day: 1, of: 4 }],
      ['2026-11-03', { kind: 'all-day' }, { day: 2, of: 4 }],
    ])
  })

  test("sorts a range's last day after the all-day rows and before what starts later", () => {
    const events = [
      event({ title: 'Morning', allDay: false, time: '08:00' }),
      event({ title: 'Overnight', allDay: false, date: '2026-10-20', time: '22:00', until: START, end: '09:00' }),
      event({ title: 'Holiday' }),
    ]
    expect(titles(events)).toEqual([[START, ['Holiday', 'Overnight', 'Morning']]])
  })

  test("draws today's now line between what has started and what is to come", () => {
    const events = [
      event({ title: 'Holiday' }),
      event({ title: 'Standup', allDay: false, time: '09:00', until: START, end: '09:15' }),
      event({ title: 'Review', allDay: false, time: '11:30', until: START, end: '12:30' }),
      event({ title: 'Lunch', allDay: false, time: '13:00', until: START, end: '14:00' }),
    ]
    const [day] = buildAgenda(events, START, START, NOON)
    expect(day?.nowBefore).toBe(3)
    expect(day?.rows.map(({ event: { title }, ended }) => [title, ended])).toEqual([
      ['Holiday', false],
      ['Standup', true],
      ['Review', false],
      ['Lunch', false],
    ])
  })

  test('puts the now line after all-day rows when nothing timed has started, and last once all has', () => {
    const lunch = event({ title: 'Lunch', allDay: false, time: '13:00' })
    expect(buildAgenda([event({ title: 'Holiday' }), lunch], START, START, NOON)[0]?.nowBefore).toBe(1)
    expect(buildAgenda([lunch], START, START, 14 * 60)[0]?.nowBefore).toBe(1)
  })

  test('draws no now line on other days, nor on a today with nothing timed', () => {
    const timed = event({ title: 'Lunch', allDay: false, time: '13:00' })
    expect(buildAgenda([timed], START, '2026-10-22', NOON)[0]?.nowBefore).toBeNull()
    expect(buildAgenda([event({ title: 'Holiday' })], START, START, NOON)[0]?.nowBefore).toBeNull()
  })

  test('dims what is over: earlier days, ended times, and timed points once started', () => {
    const events = [
      event({ title: 'Yesterday', date: '2026-10-21' }),
      event({ title: 'Point', allDay: false, date: '2026-10-22', time: '09:00' }),
      event({ title: 'Running', allDay: false, date: '2026-10-21', time: '09:00', until: '2026-10-22', end: '18:00' }),
      event({ title: 'All day', date: '2026-10-22' }),
    ]
    const ended = buildAgenda(events, START, '2026-10-22', NOON).flatMap(({ rows }) =>
      rows.map(({ event: { title }, ended }) => [title, ended]),
    )
    expect(ended).toEqual([
      ['Yesterday', true],
      ['Running', false],
      ['All day', false],
      ['Running', false],
      ['Point', true],
    ])
  })
})
