import { expect, test } from 'vitest'
import { overlapsFeedsWindow, sameFeedsWindow } from './window'

const window = { start: 1_000, end: 2_000 }

test.each([
  ['a moment inside', { start: 1_500, end: null }, true],
  ['a moment before', { start: 999, end: null }, false],
  ['a range ending on the first instant', { start: 500, end: 1_000 }, true],
  ['a range starting on the last instant', { start: 2_000, end: 3_000 }, true],
  ['a range around it', { start: 0, end: 5_000 }, true],
  ['a range after it', { start: 2_001, end: 3_000 }, false]
])('%s', (_, occurrence, expected) => {
  expect(overlapsFeedsWindow(occurrence, window)).toBe(expected)
})

test('two windows are the same by their ends', () => {
  expect(sameFeedsWindow(window, { start: 1_000, end: 2_000 })).toBe(true)
  expect(sameFeedsWindow(window, { start: 1_000, end: 2_001 })).toBe(false)
  expect(sameFeedsWindow(null, null)).toBe(true)
  expect(sameFeedsWindow(window, null)).toBe(false)
})
