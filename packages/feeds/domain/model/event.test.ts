import { expect, test } from 'vitest'
import { compareFeedsEvents, type FeedsEvent } from './event'

const event = (id: string, start: number, rank: number, title = 'Meeting'): FeedsEvent => ({
  id,
  feedId: `feed_${rank}`,
  rank,
  title,
  start,
  end: null,
  allDay: false
})

test('orders by start, then by the subscription order, then title, then id', () => {
  const sorted = [
    event('d', 2, 1, 'A'),
    event('c', 2, 0, 'B'),
    event('b', 2, 0, 'A'),
    event('a', 1, 3),
    event('e', 2, 0, 'A')
  ].sort(compareFeedsEvents)
  expect(sorted.map(({ id }) => id)).toEqual(['a', 'b', 'e', 'c', 'd'])
})
