import { describe, expect, test } from 'vitest'
import type { EventsDatedObject } from './dated-object'
import {
  nextEventsSpanLoad,
  shownEventsSpan,
  type EventsSpanLoad,
  type EventsSpanResult
} from './span-load'

const MARCH = { kind: 'month', year: 2026, month: 2 } as const
const APRIL = { kind: 'month', year: 2026, month: 3 } as const

const OBJECT: EventsDatedObject = {
  id: 'obj_1',
  spaceId: 'sp_1',
  typeKey: 'task',
  title: 'Ship it',
  start: 1_000,
  end: null,
  allDay: false
}

const LAST: EventsSpanResult = { span: MARCH, objects: [OBJECT], loadedAt: 1_000 }

const idle: EventsSpanLoad = { phase: 'idle' }
const loading: EventsSpanLoad = { phase: 'loading', span: MARCH }
const loaded: EventsSpanLoad = { phase: 'loaded', last: LAST }
const failed: EventsSpanLoad = { phase: 'failed', span: APRIL, failure: 'unreachable', at: 2_000 }

describe('load-started', () => {
  test('starts from idle with no previous result', () => {
    expect(nextEventsSpanLoad(idle, { type: 'load-started', span: MARCH })).toEqual(loading)
  })

  test('keeps the previous result, whichever span it was for', () => {
    expect(nextEventsSpanLoad(loaded, { type: 'load-started', span: APRIL })).toEqual({
      phase: 'loading',
      span: APRIL,
      last: LAST
    })
    expect(nextEventsSpanLoad({ ...failed, last: LAST }, { type: 'load-started', span: APRIL })).toEqual({
      phase: 'loading',
      span: APRIL,
      last: LAST
    })
  })

  test('replaces a load that is running, even for the same span', () => {
    const next = nextEventsSpanLoad(loading, { type: 'load-started', span: MARCH })
    expect(next).toEqual(loading)
    expect(next).not.toBe(loading)
  })
})

describe('load-succeeded', () => {
  test('records the objects for the span being loaded', () => {
    expect(
      nextEventsSpanLoad(
        { phase: 'loading', span: APRIL, last: LAST },
        { type: 'load-succeeded', objects: [], at: 5_000 }
      )
    ).toEqual({ phase: 'loaded', last: { span: APRIL, objects: [], loadedAt: 5_000 } })
  })

  test('is ignored outside a load', () => {
    for (const state of [idle, loaded, failed]) {
      expect(nextEventsSpanLoad(state, { type: 'load-succeeded', objects: [OBJECT], at: 5_000 })).toBe(state)
    }
  })
})

describe('load-failed', () => {
  test('records the failure for the span and keeps the previous result', () => {
    expect(
      nextEventsSpanLoad(
        { phase: 'loading', span: APRIL, last: LAST },
        { type: 'load-failed', failure: 'unauthorized', at: 5_000 }
      )
    ).toEqual({ phase: 'failed', span: APRIL, failure: 'unauthorized', at: 5_000, last: LAST })
  })

  test('carries no result when nothing was loaded yet', () => {
    expect(nextEventsSpanLoad(loading, { type: 'load-failed', failure: 'unreachable', at: 5_000 })).toEqual({
      phase: 'failed',
      span: MARCH,
      failure: 'unreachable',
      at: 5_000
    })
  })

  test('is ignored outside a load', () => {
    for (const state of [idle, loaded, failed]) {
      expect(nextEventsSpanLoad(state, { type: 'load-failed', failure: 'unreachable', at: 5_000 })).toBe(
        state
      )
    }
  })
})

describe('reset', () => {
  test('forgets everything from any phase', () => {
    for (const state of [loading, loaded, failed]) {
      expect(nextEventsSpanLoad(state, { type: 'reset' })).toEqual({ phase: 'idle' })
    }
  })

  test('is ignored when already idle', () => {
    expect(nextEventsSpanLoad(idle, { type: 'reset' })).toBe(idle)
  })
})

describe('shownEventsSpan', () => {
  test('is the span being loaded, loaded, or failed', () => {
    expect(shownEventsSpan(idle)).toBeNull()
    expect(shownEventsSpan({ phase: 'loading', span: APRIL, last: LAST })).toEqual(APRIL)
    expect(shownEventsSpan(loaded)).toEqual(MARCH)
    expect(shownEventsSpan({ ...failed, last: LAST })).toEqual(APRIL)
  })
})
