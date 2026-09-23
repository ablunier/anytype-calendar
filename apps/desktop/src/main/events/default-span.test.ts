import { describe, expect, test } from 'vitest'
import { defaultEventsSpan } from './default-span'

// A Wednesday.
const TODAY = { year: 2026, month: 8, day: 23 }

describe('defaultEventsSpan', () => {
  test('opens a month view on the month today falls in', () => {
    expect(defaultEventsSpan('month', TODAY, 0)).toEqual({ kind: 'month', year: 2026, month: 8 })
  })

  test('opens a day view on today', () => {
    expect(defaultEventsSpan('day', TODAY, 0)).toEqual({ kind: 'day', start: TODAY })
  })

  test("opens a week view on the user's own first day of the week", () => {
    expect(defaultEventsSpan('week', TODAY, 0)).toEqual({
      kind: 'week',
      start: { year: 2026, month: 8, day: 21 }
    })
    expect(defaultEventsSpan('week', TODAY, 6)).toEqual({
      kind: 'week',
      start: { year: 2026, month: 8, day: 20 }
    })
  })

  test('stays put when today already starts the week', () => {
    const monday = { year: 2026, month: 8, day: 21 }
    expect(defaultEventsSpan('week', monday, 0)).toEqual({ kind: 'week', start: monday })
  })

  test('reaches back into the previous month, and the previous year', () => {
    expect(defaultEventsSpan('week', { year: 2026, month: 9, day: 1 }, 0)).toEqual({
      kind: 'week',
      start: { year: 2026, month: 8, day: 28 }
    })
    expect(defaultEventsSpan('week', { year: 2027, month: 0, day: 1 }, 0)).toEqual({
      kind: 'week',
      start: { year: 2026, month: 11, day: 28 }
    })
  })
})
