import { describe, expect, test } from 'vitest'
import type { FeedsCalendar, FeedsTimeZone, FeedsWindow } from '../../domain'
import { IcalFeedsCalendarParser } from './ical-feeds-calendar-parser'

const HOUR_MS = 3_600_000

/**
 * Madrid in 2026: one hour ahead of UTC until the clocks go forward at 01:00 UTC on 29 March,
 * two hours ahead until they go back at 01:00 UTC on 25 October.
 */
const offsetAt = (instant: number): number =>
  instant >= Date.UTC(2026, 2, 29, 1) && instant < Date.UTC(2026, 9, 25, 1) ? 2 * HOUR_MS : HOUR_MS
const local = (year: number, month: number, day: number, hours = 0, minutes = 0): number => {
  const wall = Date.UTC(year, month - 1, day, hours, minutes)
  return wall - offsetAt(wall - offsetAt(wall))
}
const ZONE: FeedsTimeZone = {
  startOfDay: ({ year, month, day }) => local(year, month + 1, day),
  at: ({ year, month, day }, minute) => local(year, month + 1, day, 0, minute)
}

const parser = new IcalFeedsCalendarParser(ZONE)

const calendar = (...lines: string[]): FeedsCalendar => {
  const parsed = parser.parse(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//EN', ...lines, 'END:VCALENDAR'].join('\r\n'))
  if (!parsed) throw new Error('not parsed')
  return parsed
}

const event = (...lines: string[]): string[] => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']

/** From the first instant of the first day to the last of the last, in Madrid. */
const days = (from: [number, number, number], to: [number, number, number]): FeedsWindow => ({
  start: local(...from),
  end: local(to[0], to[1], to[2] + 1) - 1
})

const MARCH = days([2026, 3, 1], [2026, 3, 31])

describe('reading a feed', () => {
  test('reads an event with its title, place, notes and link', () => {
    const feed = calendar(
      ...event(
        'UID:launch@example.com',
        'DTSTART:20260310T090000Z',
        'DTEND:20260310T100000Z',
        'SUMMARY:Launch review',
        'LOCATION:Room 4',
        'DESCRIPTION:Bring the numbers\\nand the slides',
        'URL:https://example.com/launch'
      )
    )
    expect(feed.occurrencesIn(MARCH)).toEqual([
      {
        id: 'launch@example.com',
        title: 'Launch review',
        start: Date.UTC(2026, 2, 10, 9),
        end: Date.UTC(2026, 2, 10, 10),
        allDay: false,
        location: 'Room 4',
        description: 'Bring the numbers\nand the slides',
        url: 'https://example.com/launch'
      }
    ])
  })

  test('takes the name the feed gives itself', () => {
    expect(calendar('X-WR-CALNAME:Holidays in Spain').name).toBe('Holidays in Spain')
    expect(calendar().name).toBeNull()
  })

  test('leaves out a link that is not a web page', () => {
    const feed = calendar(...event('UID:a', 'DTSTART:20260310T090000Z', 'URL:javascript:alert(1)'))
    expect(feed.occurrencesIn(MARCH)[0]).not.toHaveProperty('url')
  })

  test.each([
    ['an HTML page', '<!doctype html><title>Sign in</title>'],
    ['nothing', ''],
    ['a vCard', 'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Ada\r\nEND:VCARD'],
    ['a calendar cut short', 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;BROKEN']
  ])('refuses %s', (_, text) => {
    expect(parser.parse(text)).toBeNull()
  })

  test('only keeps what overlaps the window', () => {
    const feed = calendar(
      ...event('UID:feb', 'DTSTART:20260215T090000Z'),
      ...event('UID:march', 'DTSTART:20260315T090000Z'),
      ...event('UID:across', 'DTSTART:20260225T090000Z', 'DTEND:20260302T090000Z'),
      ...event('UID:april', 'DTSTART:20260415T090000Z')
    )
    expect(feed.occurrencesIn(MARCH).map(({ id }) => id).sort()).toEqual(['across', 'march'])
  })

  test('tells apart events sharing a UID, and ones with none', () => {
    const feed = calendar(
      ...event('UID:same', 'DTSTART:20260310T090000Z'),
      ...event('UID:same', 'DTSTART:20260311T090000Z'),
      ...event('DTSTART:20260312T090000Z')
    )
    const ids = feed.occurrencesIn(MARCH).map(({ id }) => id)
    expect(new Set(ids).size).toBe(3)
  })

  test('leaves out a cancelled event', () => {
    const feed = calendar(...event('UID:a', 'DTSTART:20260310T090000Z', 'STATUS:CANCELLED'))
    expect(feed.occurrencesIn(MARCH)).toEqual([])
  })

  test('draws an event with no end as a moment', () => {
    const feed = calendar(...event('UID:a', 'DTSTART:20260310T090000Z'))
    expect(feed.occurrencesIn(MARCH)[0]).toMatchObject({ end: null, allDay: false })
  })
})

describe('all-day events', () => {
  test('a one-day event, whose end is the next day, is a single day', () => {
    const feed = calendar(...event('UID:a', 'DTSTART;VALUE=DATE:20260319', 'DTEND;VALUE=DATE:20260320', 'SUMMARY:San José'))
    expect(feed.occurrencesIn(MARCH)).toEqual([
      { id: 'a', title: 'San José', start: local(2026, 3, 19), end: null, allDay: true }
    ])
  })

  test('a multi-day event ends on its last day, not the day after', () => {
    const feed = calendar(...event('UID:a', 'DTSTART;VALUE=DATE:20260330', 'DTEND;VALUE=DATE:20260403'))
    expect(feed.occurrencesIn(MARCH)[0]).toMatchObject({ start: local(2026, 3, 30), end: local(2026, 4, 2), allDay: true })
  })

  test('one with no end, or a duration, is a single day, or as many as it lasts', () => {
    const feed = calendar(
      ...event('UID:bare', 'DTSTART;VALUE=DATE:20260305'),
      ...event('UID:week', 'DTSTART;VALUE=DATE:20260309', 'DURATION:P7D')
    )
    const byId = new Map(feed.occurrencesIn(MARCH).map((occurrence) => [occurrence.id, occurrence]))
    expect(byId.get('bare')).toMatchObject({ start: local(2026, 3, 5), end: null })
    expect(byId.get('week')).toMatchObject({ start: local(2026, 3, 9), end: local(2026, 3, 15) })
  })

  test('falls on the same day wherever the day changes the clocks', () => {
    const feed = calendar(...event('UID:a', 'DTSTART;VALUE=DATE:20260329', 'DTEND;VALUE=DATE:20260331'))
    expect(feed.occurrencesIn(MARCH)[0]).toMatchObject({ start: local(2026, 3, 29), end: local(2026, 3, 30) })
  })
})

describe('time zones', () => {
  const NEW_YORK = [
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE'
  ]

  test('reads a time in the zone the feed defines', () => {
    const feed = calendar(
      ...NEW_YORK,
      ...event('UID:a', 'DTSTART;TZID=America/New_York:20260310T090000', 'DTEND;TZID=America/New_York:20260310T103000')
    )
    expect(feed.occurrencesIn(MARCH)[0]).toMatchObject({ start: Date.UTC(2026, 2, 10, 13), end: Date.UTC(2026, 2, 10, 14, 30) })
  })

  test('reads a time in a zone the feed names but leaves undefined by its IANA name', () => {
    const feed = calendar(...event('UID:a', 'DTSTART;TZID=Asia/Tokyo:20260310T090000'))
    expect(feed.occurrencesIn(MARCH)[0]?.start).toBe(Date.UTC(2026, 2, 10, 0))
  })

  test('reads a floating time, or one in a zone nobody knows, on the user’s own clock', () => {
    const feed = calendar(
      ...event('UID:floating', 'DTSTART:20260310T090000'),
      ...event('UID:unknown', 'DTSTART;TZID=Somewhere Standard Time:20260311T090000')
    )
    const byId = new Map(feed.occurrencesIn(MARCH).map((occurrence) => [occurrence.id, occurrence.start]))
    expect(byId.get('floating')).toBe(local(2026, 3, 10, 9))
    expect(byId.get('unknown')).toBe(local(2026, 3, 11, 9))
  })

  test('keeps a weekly time on its clock across a change of the clocks, by the feed’s zone', () => {
    const feed = calendar(
      ...NEW_YORK,
      ...event('UID:a', 'DTSTART;TZID=America/New_York:20260302T090000', 'DURATION:PT1H', 'RRULE:FREQ=WEEKLY;COUNT=3')
    )
    expect(feed.occurrencesIn(MARCH).map(({ start }) => start).sort()).toEqual([
      Date.UTC(2026, 2, 2, 14),
      Date.UTC(2026, 2, 9, 13),
      Date.UTC(2026, 2, 16, 13)
    ])
  })

  test('keeps a weekly time on its clock across a change of the clocks, by an IANA zone', () => {
    const feed = calendar(
      ...event('UID:a', 'DTSTART;TZID=Europe/Madrid:20260323T100000', 'DTEND;TZID=Europe/Madrid:20260323T110000', 'RRULE:FREQ=WEEKLY;COUNT=2')
    )
    expect(feed.occurrencesIn(days([2026, 3, 20], [2026, 4, 5]))).toEqual([
      expect.objectContaining({ start: Date.UTC(2026, 2, 23, 9), end: Date.UTC(2026, 2, 23, 10) }),
      expect.objectContaining({ start: Date.UTC(2026, 2, 30, 8), end: Date.UTC(2026, 2, 30, 9) })
    ])
  })

  test('keeps a floating weekly time on the user’s clock across a change of the clocks', () => {
    const feed = calendar(...event('UID:a', 'DTSTART:20260323T100000', 'RRULE:FREQ=WEEKLY;COUNT=2'))
    expect(feed.occurrencesIn(days([2026, 3, 20], [2026, 4, 5])).map(({ start }) => start)).toEqual([
      local(2026, 3, 23, 10),
      local(2026, 3, 30, 10)
    ])
  })
})

describe('recurring events', () => {
  test('expands a rule into the window only, each instance with an id of its own', () => {
    const feed = calendar(
      ...event('UID:standup', 'DTSTART:20260105T090000Z', 'DTEND:20260105T091500Z', 'RRULE:FREQ=WEEKLY;BYDAY=MO', 'SUMMARY:Standup')
    )
    const march = feed.occurrencesIn(MARCH)
    expect(march.map(({ start }) => new Date(start).toISOString().slice(0, 10))).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
      '2026-03-30'
    ])
    expect(march[0]).toEqual({
      id: `standup#${Date.UTC(2026, 2, 2, 9)}`,
      title: 'Standup',
      start: Date.UTC(2026, 2, 2, 9),
      end: Date.UTC(2026, 2, 2, 9, 15),
      allDay: false
    })
    expect(new Set(march.map(({ id }) => id)).size).toBe(5)
  })

  test('the same instance keeps its id from one window to another', () => {
    const feed = calendar(...event('UID:a', 'DTSTART:20260105T090000Z', 'RRULE:FREQ=DAILY'))
    const inMarch = feed.occurrencesIn(MARCH).find(({ start }) => start === Date.UTC(2026, 2, 31, 9))
    const inApril = feed.occurrencesIn(days([2026, 3, 30], [2026, 4, 30])).find(({ start }) => start === Date.UTC(2026, 2, 31, 9))
    expect(inMarch?.id).toBe(inApril?.id)
  })

  test('leaves out the dates EXDATE takes away', () => {
    const feed = calendar(
      ...event('UID:a', 'DTSTART:20260302T090000Z', 'RRULE:FREQ=WEEKLY;COUNT=4', 'EXDATE:20260309T090000Z,20260316T090000Z')
    )
    expect(feed.occurrencesIn(MARCH).map(({ start }) => new Date(start).getUTCDate())).toEqual([2, 23])
  })

  test('draws an overridden instance where, and as, the override says', () => {
    const feed = calendar(
      ...event('UID:a', 'DTSTART:20260302T090000Z', 'DTEND:20260302T100000Z', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Review'),
      ...event('UID:a', 'RECURRENCE-ID:20260309T090000Z', 'DTSTART:20260310T150000Z', 'DTEND:20260310T153000Z', 'SUMMARY:Review (moved)')
    )
    expect(
      feed
        .occurrencesIn(MARCH)
        .map(({ id, title, start, end }) => ({ id, title, start, end }))
        .sort((a, b) => a.start - b.start)
    ).toEqual([
      { id: `a#${Date.UTC(2026, 2, 2, 9)}`, title: 'Review', start: Date.UTC(2026, 2, 2, 9), end: Date.UTC(2026, 2, 2, 10) },
      {
        id: `a#${Date.UTC(2026, 2, 9, 9)}`,
        title: 'Review (moved)',
        start: Date.UTC(2026, 2, 10, 15),
        end: Date.UTC(2026, 2, 10, 15, 30)
      },
      { id: `a#${Date.UTC(2026, 2, 16, 9)}`, title: 'Review', start: Date.UTC(2026, 2, 16, 9), end: Date.UTC(2026, 2, 16, 10) }
    ])
  })

  test('finds an instance moved into the window from one after it', () => {
    const feed = calendar(
      ...event('UID:a', 'DTSTART:20260302T090000Z', 'RRULE:FREQ=MONTHLY;COUNT=3'),
      ...event('UID:a', 'RECURRENCE-ID:20260402T090000Z', 'DTSTART:20260327T090000Z')
    )
    expect(feed.occurrencesIn(MARCH).map(({ start }) => start).sort()).toEqual([
      Date.UTC(2026, 2, 2, 9),
      Date.UTC(2026, 2, 27, 9)
    ])
    expect(feed.occurrencesIn(days([2026, 4, 1], [2026, 4, 30]))).toEqual([])
  })

  test('leaves out an instance its override cancels', () => {
    const feed = calendar(
      ...event('UID:a', 'DTSTART:20260302T090000Z', 'RRULE:FREQ=WEEKLY;COUNT=2'),
      ...event('UID:a', 'RECURRENCE-ID:20260309T090000Z', 'DTSTART:20260309T090000Z', 'STATUS:CANCELLED')
    )
    expect(feed.occurrencesIn(MARCH).map(({ start }) => start)).toEqual([Date.UTC(2026, 2, 2, 9)])
  })

  test('expands an all-day rule, each instance a day', () => {
    const feed = calendar(
      ...event('UID:a', 'DTSTART;VALUE=DATE:20250319', 'DTEND;VALUE=DATE:20250320', 'RRULE:FREQ=YEARLY', 'SUMMARY:Birthday')
    )
    expect(feed.occurrencesIn(MARCH)).toEqual([
      { id: `a#${local(2026, 3, 19)}`, title: 'Birthday', start: local(2026, 3, 19), end: null, allDay: true }
    ])
  })

  test('draws an override whose event the feed left out on its own', () => {
    const feed = calendar(...event('UID:orphan', 'RECURRENCE-ID:20260309T090000Z', 'DTSTART:20260309T100000Z'))
    expect(feed.occurrencesIn(MARCH).map(({ start }) => start)).toEqual([Date.UTC(2026, 2, 9, 10)])
  })

  test('walks a rule once, however many windows it is expanded over', () => {
    const feed = calendar(...event('UID:a', 'DTSTART:20260105T090000Z', 'RRULE:FREQ=DAILY'))
    const april = days([2026, 4, 1], [2026, 4, 30])
    expect(feed.occurrencesIn(april)).toHaveLength(30)
    expect(feed.occurrencesIn(MARCH)).toHaveLength(31)
    expect(feed.occurrencesIn(days([2026, 1, 1], [2026, 1, 3]))).toHaveLength(0)
    expect(feed.occurrencesIn(april)).toHaveLength(30)
  })

  test('is read once for a text it has already read', () => {
    const text = ['BEGIN:VCALENDAR', 'END:VCALENDAR'].join('\r\n')
    expect(parser.parse(text)).toBe(parser.parse(text))
  })

  test('stops a rule recurring every second, and keeps the other events', () => {
    const feed = calendar(
      ...event('UID:flood', 'DTSTART:20260301T000000Z', 'RRULE:FREQ=SECONDLY'),
      ...event('UID:b', 'DTSTART:20260310T090000Z')
    )
    expect(feed.occurrencesIn(MARCH).some(({ id }) => id === 'b')).toBe(true)
  })
})
