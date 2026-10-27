import { expect, test } from 'vitest'
import { isOpenableLink } from './links'

test.each(['https://example.com/a?b=c', 'http://example.com', 'mailto:iris@example.com', 'tel:+34600000000'])(
  'opens %s',
  (link) => {
    expect(isOpenableLink(link)).toBe(true)
  }
)

test.each([
  ['a file', 'file:///etc/passwd'],
  ['a script', 'javascript:alert(1)'],
  ['an Anytype deep link', 'anytype://object?objectId=x'],
  ['no URL', 'example.com'],
  ['not a string', 42]
])('refuses %s', (_, link) => {
  expect(isOpenableLink(link)).toBe(false)
})
