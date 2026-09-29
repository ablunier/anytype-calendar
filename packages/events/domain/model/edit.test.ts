import { describe, expect, test } from 'vitest'
import type { EventsTimeZone } from '../gateways/time-zone'
import type { EventsDatedObject } from './dated-object'
import {
  newEventsObjectDates,
  rescheduleEventsDatedObject,
  toEventsReschedule,
  toEventsSlot,
  withEventsEdits
} from './edit'
import type { EventsTypeSource } from './source'
import type { EventsSpanLoad } from './span-load'

const HOUR_MS = 3_600_000

/**
 * One hour ahead of UTC until the clocks spring forward at 02:00 on 29 March 2026, two hours
 * ahead from then: 29 March is 23 hours long.
 */
const SPRING = Date.UTC(2026, 2, 29, 1)
const wallOffset = (wall: number): number => (wall < Date.UTC(2026, 2, 29, 2) ? 1 : 2) * HOUR_MS
const ZONE: EventsTimeZone = {
  startOfDay: ({ year, month, day }) => {
    const wall = Date.UTC(year, month, day)
    return wall - wallOffset(wall)
  },
  at: ({ year, month, day }, minute) => {
    const wall = Date.UTC(year, month, day, 0, minute)
    return wall - wallOffset(wall)
  },
  dayOf: (instant) => {
    const date = new Date(instant + (instant < SPRING ? 1 : 2) * HOUR_MS)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() }
  }
}

const march = (day: number) => ({ year: 2026, month: 2, day })

/** Epoch milliseconds of a local wall-clock time in March 2026. */
const local = (day: number, hours = 0, minutes = 0): number => ZONE.at(march(day), hours * 60 + minutes)

const object = (fields: Partial<EventsDatedObject>): EventsDatedObject => ({
  id: 'obj_1',
  spaceId: 'sp_1',
  source: { kind: 'type', typeKey: 'meeting' },
  title: 'Standup',
  start: local(28, 10),
  end: local(28, 11),
  allDay: false,
  ...fields
})

describe('moving a timed object', () => {
  test('lands on the clock time asked for and keeps how long it lasts, across a change of the clocks', () => {
    const moved = rescheduleEventsDatedObject(
      object({}),
      { kind: 'move', start: { day: march(29), minute: 10 * 60 } },
      ZONE
    )
    expect(moved).toMatchObject({ start: local(29, 10), end: local(29, 11) })
    expect(moved?.start).toBe(Date.UTC(2026, 2, 29, 8))
  })

  test('keeps its time of day when moved to a slot with no minute, whichever way the clocks went', () => {
    const springDay = object({ start: local(29, 10), end: null })
    expect(
      rescheduleEventsDatedObject(springDay, { kind: 'move', start: { day: march(30), minute: null } }, ZONE)
    ).toMatchObject({ start: local(30, 10), end: null })

    expect(
      rescheduleEventsDatedObject(object({}), { kind: 'move', start: { day: march(29), minute: null } }, ZONE)
    ).toMatchObject({ start: local(29, 10), end: local(29, 11) })
  })
})

describe('moving an all-day object', () => {
  test('writes the first instant of the new day, and keeps how many days a range covers', () => {
    const range = object({ allDay: true, start: local(27), end: local(29) })
    expect(
      rescheduleEventsDatedObject(range, { kind: 'move', start: { day: march(28), minute: null } }, ZONE)
    ).toMatchObject({ start: local(28), end: local(30) })
  })

  test('drops whatever time of day a date carried, and ignores a minute', () => {
    const odd = object({ allDay: true, start: local(27, 13, 20), end: null })
    expect(
      rescheduleEventsDatedObject(odd, { kind: 'move', start: { day: march(2), minute: 600 } }, ZONE)
    ).toMatchObject({ start: local(2), end: null })
  })
})

describe('resizing', () => {
  test('moves the To date alone', () => {
    expect(
      rescheduleEventsDatedObject(object({}), { kind: 'resize', end: { day: march(28), minute: 12 * 60 + 15 } }, ZONE)
    ).toMatchObject({ start: local(28, 10), end: local(28, 12, 15) })
    expect(
      rescheduleEventsDatedObject(
        object({ allDay: true, start: local(27), end: null }),
        { kind: 'resize', end: { day: march(30), minute: null } },
        ZONE
      )
    ).toMatchObject({ start: local(27), end: local(30) })
  })

  test('refuses a To before the From', () => {
    expect(
      rescheduleEventsDatedObject(object({}), { kind: 'resize', end: { day: march(28), minute: 9 * 60 } }, ZONE)
    ).toBeNull()
  })
})

describe('a new object', () => {
  const source: EventsTypeSource = {
    kind: 'type',
    spaceId: 'sp_1',
    typeKey: 'meeting',
    from: 'start_date',
    to: 'end_date',
    includesTime: true
  }

  test('is timed at the slot, or at nine when it names no minute, and lasts an hour where it has a To', () => {
    expect(newEventsObjectDates(source, { day: march(29), minute: 14 * 60 + 30 }, ZONE)).toEqual({
      start_date: local(29, 14, 30),
      end_date: local(29, 15, 30)
    })
    expect(newEventsObjectDates(source, { day: march(29), minute: null }, ZONE)).toEqual({
      start_date: local(29, 9),
      end_date: local(29, 10)
    })
  })

  test('is placed on the day alone where its dates carry no time, and fills only the dates it has', () => {
    expect(
      newEventsObjectDates({ ...source, includesTime: false }, { day: march(29), minute: 600 }, ZONE)
    ).toEqual({ start_date: local(29), end_date: local(29) })
    expect(newEventsObjectDates({ ...source, to: null }, { day: march(29), minute: 600 }, ZONE)).toEqual({
      start_date: local(29, 10)
    })
  })
})

describe('reading a change from the renderer', () => {
  test('takes a slot with a minute within the day, or none', () => {
    expect(toEventsSlot({ day: march(3), minute: 0 })).toEqual({ day: march(3), minute: 0 })
    expect(toEventsSlot({ day: march(3), minute: null })).toEqual({ day: march(3), minute: null })
    expect(toEventsSlot({ day: march(3), minute: 1440 })).toBeNull()
    expect(toEventsSlot({ day: march(3), minute: 1.5 })).toBeNull()
    expect(toEventsSlot({ day: march(3) })).toBeNull()
    expect(toEventsSlot({ day: { year: 2026, month: 12, day: 1 }, minute: null })).toBeNull()
  })

  test('takes a move or a resize, and nothing else', () => {
    const slot = { day: march(3), minute: null }
    expect(toEventsReschedule({ kind: 'move', start: slot })).toEqual({ kind: 'move', start: slot })
    expect(toEventsReschedule({ kind: 'resize', end: slot })).toEqual({ kind: 'resize', end: slot })
    expect(toEventsReschedule({ kind: 'move', end: slot })).toBeNull()
    expect(toEventsReschedule({ kind: 'delete', start: slot })).toBeNull()
    expect(toEventsReschedule(null)).toBeNull()
  })
})

describe('drawing the edits in flight', () => {
  const standup = object({})
  const review = object({ id: 'obj_2', title: 'Review', start: local(28, 12), end: null })
  const loaded: EventsSpanLoad = {
    phase: 'loaded',
    last: { span: { kind: 'month', year: 2026, month: 2 }, objects: [standup, review], loadedAt: 0 }
  }

  test('draws each edited object in place of the one it edits, in order, the latest edit winning', () => {
    const early = { ...standup, start: local(28, 13) }
    const later = { ...standup, start: local(28, 14), end: local(28, 15) }
    const shown = withEventsEdits(loaded, [early, later])
    expect(shown.phase === 'loaded' && shown.last.objects).toEqual([review, later])
  })

  test('leaves the load as it is when no edit is of an object in it', () => {
    expect(withEventsEdits(loaded, [object({ id: 'obj_9' })])).toBe(loaded)
    expect(withEventsEdits(loaded, [])).toBe(loaded)
    const idle: EventsSpanLoad = { phase: 'idle' }
    expect(withEventsEdits(idle, [standup])).toBe(idle)
  })
})
