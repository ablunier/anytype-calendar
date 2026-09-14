import { describe, expect, test } from 'vitest'
import type { EventsDatedObject } from './dated-object'
import {
  nextEventsMonthLoad,
  shownEventsMonth,
  type EventsMonthLoad,
  type EventsMonthResult
} from './month-load'

const MARCH = { year: 2026, month: 2 }
const APRIL = { year: 2026, month: 3 }

const OBJECT: EventsDatedObject = {
  id: 'obj_1',
  spaceId: 'sp_1',
  typeKey: 'task',
  title: 'Ship it',
  start: 1_000,
  end: null,
  allDay: false
}

const LAST: EventsMonthResult = { month: MARCH, objects: [OBJECT], loadedAt: 1_000 }

const idle: EventsMonthLoad = { phase: 'idle' }
const loading: EventsMonthLoad = { phase: 'loading', month: MARCH }
const loaded: EventsMonthLoad = { phase: 'loaded', last: LAST }
const failed: EventsMonthLoad = { phase: 'failed', month: APRIL, failure: 'unreachable', at: 2_000 }

describe('load-started', () => {
  test('starts from idle with no previous result', () => {
    expect(nextEventsMonthLoad(idle, { type: 'load-started', month: MARCH })).toEqual(loading)
  })

  test('keeps the previous result, whichever month it was for', () => {
    expect(nextEventsMonthLoad(loaded, { type: 'load-started', month: APRIL })).toEqual({
      phase: 'loading',
      month: APRIL,
      last: LAST
    })
    expect(nextEventsMonthLoad({ ...failed, last: LAST }, { type: 'load-started', month: APRIL })).toEqual({
      phase: 'loading',
      month: APRIL,
      last: LAST
    })
  })

  test('replaces a load that is running, even for the same month', () => {
    const next = nextEventsMonthLoad(loading, { type: 'load-started', month: MARCH })
    expect(next).toEqual(loading)
    expect(next).not.toBe(loading)
  })
})

describe('load-succeeded', () => {
  test('records the objects for the month being loaded', () => {
    expect(
      nextEventsMonthLoad(
        { phase: 'loading', month: APRIL, last: LAST },
        { type: 'load-succeeded', objects: [], at: 5_000 }
      )
    ).toEqual({ phase: 'loaded', last: { month: APRIL, objects: [], loadedAt: 5_000 } })
  })

  test('is ignored outside a load', () => {
    for (const state of [idle, loaded, failed]) {
      expect(nextEventsMonthLoad(state, { type: 'load-succeeded', objects: [OBJECT], at: 5_000 })).toBe(state)
    }
  })
})

describe('load-failed', () => {
  test('records the failure for the month and keeps the previous result', () => {
    expect(
      nextEventsMonthLoad(
        { phase: 'loading', month: APRIL, last: LAST },
        { type: 'load-failed', failure: 'unauthorized', at: 5_000 }
      )
    ).toEqual({ phase: 'failed', month: APRIL, failure: 'unauthorized', at: 5_000, last: LAST })
  })

  test('carries no result when nothing was loaded yet', () => {
    expect(nextEventsMonthLoad(loading, { type: 'load-failed', failure: 'unreachable', at: 5_000 })).toEqual({
      phase: 'failed',
      month: MARCH,
      failure: 'unreachable',
      at: 5_000
    })
  })

  test('is ignored outside a load', () => {
    for (const state of [idle, loaded, failed]) {
      expect(nextEventsMonthLoad(state, { type: 'load-failed', failure: 'unreachable', at: 5_000 })).toBe(
        state
      )
    }
  })
})

describe('reset', () => {
  test('forgets everything from any phase', () => {
    for (const state of [loading, loaded, failed]) {
      expect(nextEventsMonthLoad(state, { type: 'reset' })).toEqual({ phase: 'idle' })
    }
  })

  test('is ignored when already idle', () => {
    expect(nextEventsMonthLoad(idle, { type: 'reset' })).toBe(idle)
  })
})

describe('shownEventsMonth', () => {
  test('is the month being loaded, loaded, or failed', () => {
    expect(shownEventsMonth(idle)).toBeNull()
    expect(shownEventsMonth({ phase: 'loading', month: APRIL, last: LAST })).toEqual(APRIL)
    expect(shownEventsMonth(loaded)).toEqual(MARCH)
    expect(shownEventsMonth({ ...failed, last: LAST })).toEqual(APRIL)
  })
})
