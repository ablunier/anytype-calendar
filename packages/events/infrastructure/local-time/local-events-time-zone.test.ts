import { expect, test } from 'vitest'
import { LocalEventsTimeZone } from './local-events-time-zone'

// These hold in whatever zone the tests run in.
const zone = new LocalEventsTimeZone()

test("a day's start falls on that day, at local midnight", () => {
  const start = zone.startOfDay({ year: 2026, month: 8, day: 14 })
  expect(zone.dayOf(start)).toEqual({ year: 2026, month: 8, day: 14 })
  expect(new Date(start).getHours()).toBe(0)
  expect(zone.dayOf(start - 1)).toEqual({ year: 2026, month: 8, day: 13 })
})

test('rolls over the year at the end of December', () => {
  const start = zone.startOfDay({ year: 2027, month: 0, day: 1 })
  expect(zone.dayOf(start - 1)).toEqual({ year: 2026, month: 11, day: 31 })
})

test('keeps a two-digit year as written', () => {
  expect(zone.dayOf(zone.startOfDay({ year: 42, month: 5, day: 3 }))).toEqual({ year: 42, month: 5, day: 3 })
})

// eventsSpanWindow names a span's far edge relative to its first day, rather than doing the
// calendar arithmetic itself, so the roll-over the port promises has to hold here.
test('rolls a day or a month outside its range over into the neighbouring one', () => {
  expect(zone.dayOf(zone.startOfDay({ year: 2026, month: 8, day: 31 }))).toEqual({
    year: 2026,
    month: 9,
    day: 1
  })
  expect(zone.dayOf(zone.startOfDay({ year: 2026, month: 1, day: -6 }))).toEqual({
    year: 2026,
    month: 0,
    day: 25
  })
  expect(zone.dayOf(zone.startOfDay({ year: 2026, month: 12, day: 8 }))).toEqual({
    year: 2027,
    month: 0,
    day: 8
  })
})
