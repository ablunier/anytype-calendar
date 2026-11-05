import type { CalendarEvent } from '@renderer/types'
import { describe, expect, test } from 'vitest'
import {
  type CalendarDragged,
  columnAt,
  dropEdit,
  sameLanding,
  takesByDay,
  takesByTime,
  timedLanding,
} from './calendar-drag'

const DAY = '2026-09-23'
const NEXT = '2026-09-24'

const event: CalendarEvent = {
  id: 'standup',
  title: 'Standup',
  type: 'sp_1:meeting',
  space: 'sp_1',
  rank: 0,
  date: DAY,
  time: '09:00',
  end: '10:00',
  allDay: false,
  details: [],
}

const drawn = { startMinute: 9 * 60, endMinute: 10 * 60 }
const move: CalendarDragged = { kind: 'move', event, grab: { at: 'time', date: DAY, held: 20, drawn } }
const resize: CalendarDragged = { kind: 'resize', event, date: DAY, drawn }
const bar: CalendarDragged = { kind: 'move', event: { ...event, until: NEXT }, grab: { at: 'day', date: NEXT } }

describe('what each target takes', () => {
  test('the hour grid takes boxes and their ends, a day target takes bars', () => {
    expect([move, resize, bar].map(takesByTime)).toEqual([true, true, false])
    expect([move, resize, bar].map(takesByDay)).toEqual([false, false, true])
  })
})

describe('timedLanding', () => {
  test('lands a move on the day under the pointer, keeping the point it is held by', () => {
    expect(timedLanding(move, { date: NEXT, minute: 14 * 60 + 22 })).toEqual({
      date: NEXT,
      startMinute: 14 * 60,
      endMinute: 15 * 60,
    })
  })

  test('keeps a resize on the day it was drawn, whatever column the pointer is over', () => {
    expect(timedLanding(resize, { date: NEXT, minute: 11 * 60 })).toEqual({
      date: DAY,
      startMinute: 9 * 60,
      endMinute: 11 * 60,
    })
  })

  test('gives nothing for a bar, or away from the hour grid', () => {
    expect(timedLanding(bar, { date: DAY, minute: 600 })).toBeNull()
    expect(timedLanding(move, { date: DAY, minute: null })).toBeNull()
    expect(timedLanding(move, null)).toBeNull()
    expect(timedLanding(null, { date: DAY, minute: 600 })).toBeNull()
  })
})

describe('dropEdit', () => {
  test('moves a box to where it lands', () => {
    expect(dropEdit(move, { date: DAY, minute: 11 * 60 + 20 })).toEqual({
      kind: 'move',
      slot: { date: DAY, minute: 11 * 60 },
    })
  })

  test('moves a box to the same minute on another day', () => {
    expect(dropEdit(move, { date: NEXT, minute: 9 * 60 + 20 })).toEqual({
      kind: 'move',
      slot: { date: NEXT, minute: 9 * 60 },
    })
  })

  test('asks for nothing when a box lands where it was', () => {
    expect(dropEdit(move, { date: DAY, minute: 9 * 60 + 25 })).toBeNull()
  })

  test('resizes to where the end lands', () => {
    expect(dropEdit(resize, { date: DAY, minute: 10 * 60 + 47 })).toEqual({
      kind: 'resize',
      slot: { date: DAY, minute: 10 * 60 + 45 },
    })
  })

  test('asks for nothing when a resize lands on its own end', () => {
    expect(dropEdit(resize, { date: DAY, minute: 10 * 60 + 5 })).toBeNull()
  })

  test('moves a bar by the days between the one held and the one it is dropped on, from its first', () => {
    expect(dropEdit(bar, { date: '2026-09-26', minute: null })).toEqual({
      kind: 'move',
      slot: { date: '2026-09-25', minute: null },
    })
    expect(dropEdit(bar, { date: NEXT, minute: null })).toBeNull()
  })
})

describe('sameLanding', () => {
  test('treats minutes that land on the same quarter hour as one place', () => {
    expect(sameLanding(move, { date: DAY, minute: 11 * 60 + 20 }, { date: DAY, minute: 11 * 60 + 26 })).toBe(true)
    expect(sameLanding(move, { date: DAY, minute: 11 * 60 + 20 }, { date: DAY, minute: 11 * 60 + 29 })).toBe(false)
  })

  test('tells days apart', () => {
    expect(sameLanding(move, { date: DAY, minute: 600 }, { date: NEXT, minute: 600 })).toBe(false)
    expect(sameLanding(bar, { date: DAY, minute: null }, { date: DAY, minute: null })).toBe(true)
    expect(sameLanding(bar, { date: DAY, minute: null }, { date: NEXT, minute: null })).toBe(false)
  })

  test('tells being over a target from not', () => {
    expect(sameLanding(move, null, null)).toBe(true)
    expect(sameLanding(move, null, { date: DAY, minute: 600 })).toBe(false)
  })
})

test('columnAt reads the column under the pointer, kept on the row', () => {
  expect(columnAt(250, 700, 7)).toBe(2)
  expect(columnAt(-5, 700, 7)).toBe(0)
  expect(columnAt(700, 700, 7)).toBe(6)
})
