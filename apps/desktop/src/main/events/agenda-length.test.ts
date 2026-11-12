import type { EventsAgendaDays, EventsSpan, EventsSpanLoad } from '@anytype-calendar/events/domain'
import { describe, expect, test, vi } from 'vitest'
import { followAgendaLength } from './agenda-length'

const START = { year: 2026, month: 10, day: 12 }

function setup(state: EventsSpanLoad) {
  let listener: (days: EventsAgendaDays) => void = () => {}
  const loadEventsSpan = { execute: vi.fn() }
  followAgendaLength({
    agendaDays: { subscribe: (next) => (listener = next) },
    eventsState: { get: () => state },
    loadEventsSpan,
  })
  return { choose: (days: EventsAgendaDays) => listener(days), loadEventsSpan }
}

function loaded(span: EventsSpan): EventsSpanLoad {
  return { phase: 'loaded', last: { span, objects: [], loadedAt: 0 } }
}

describe('followAgendaLength', () => {
  test('reads the agenda on screen again from its first day, at the new length', () => {
    const { choose, loadEventsSpan } = setup(loaded({ kind: 'agenda', start: START, days: 14 }))
    choose(28)
    expect(loadEventsSpan.execute).toHaveBeenCalledWith({ kind: 'agenda', start: START, days: 28 })
  })

  test('follows an agenda still being read', () => {
    const { choose, loadEventsSpan } = setup({ phase: 'loading', span: { kind: 'agenda', start: START, days: 14 } })
    choose(7)
    expect(loadEventsSpan.execute).toHaveBeenCalledWith({ kind: 'agenda', start: START, days: 7 })
  })

  test('reads nothing when the agenda already has that length', () => {
    const { choose, loadEventsSpan } = setup(loaded({ kind: 'agenda', start: START, days: 7 }))
    choose(7)
    expect(loadEventsSpan.execute).not.toHaveBeenCalled()
  })

  test('leaves any other span, and no span at all, alone', () => {
    const week = setup(loaded({ kind: 'week', start: START }))
    week.choose(28)
    expect(week.loadEventsSpan.execute).not.toHaveBeenCalled()

    const signedOut = setup({ phase: 'idle' })
    signedOut.choose(28)
    expect(signedOut.loadEventsSpan.execute).not.toHaveBeenCalled()
  })
})
