import { describe, expect, test } from 'vitest'
import { FEEDS_COLOURS, feedsUrlHost, nextFeedsColour, sameFeedsUrl, toFeedsName, toFeedsUrl } from './subscription'

describe('toFeedsUrl', () => {
  test.each([
    [
      'https://calendar.google.com/calendar/ical/x/private-abc/basic.ics',
      'https://calendar.google.com/calendar/ical/x/private-abc/basic.ics',
    ],
    ['http://example.com/cal.ics', 'http://example.com/cal.ics'],
    ['  https://example.com/cal.ics \n', 'https://example.com/cal.ics'],
    ['webcal://p01-caldav.icloud.com/published/2/abc', 'https://p01-caldav.icloud.com/published/2/abc'],
    ['WEBCALS://example.com/cal', 'https://example.com/cal'],
    ['HTTPS://Example.com', 'https://Example.com'],
    ['https://example.com:8443/feed?token=a#b', 'https://example.com:8443/feed?token=a#b'],
  ])('reads %s', (input, expected) => {
    expect(toFeedsUrl(input)).toBe(expected)
  })

  test.each([
    ['nothing', ''],
    ['no scheme', 'example.com/cal.ics'],
    ['another scheme', 'ftp://example.com/cal.ics'],
    ['a file', 'file:///home/me/cal.ics'],
    ['no host', 'https:///cal.ics'],
    ['only a port', 'https://:443/cal.ics'],
    ['a space inside', 'https://example.com/my cal.ics'],
    ['not a string', 42],
  ])('refuses %s', (_, input) => {
    expect(toFeedsUrl(input)).toBeNull()
  })
})

describe('feedsUrlHost', () => {
  test('is the host alone, without the credentials or the secret path', () => {
    expect(feedsUrlHost('https://me:pw@Calendar.Example.com/private-abc/basic.ics')).toBe('calendar.example.com')
    expect(feedsUrlHost('https://example.com:8443/x')).toBe('example.com:8443')
  })
})

describe('sameFeedsUrl', () => {
  test('ignores the case of the host', () => {
    expect(sameFeedsUrl('https://Calendar.Google.com/ical/abc', 'https://calendar.google.com/ical/abc')).toBe(true)
  })

  test('tells apart a path or query that differs only in case, as a secret feed may', () => {
    expect(sameFeedsUrl('https://example.com/private-AbC/basic.ics', 'https://example.com/private-abc/basic.ics')).toBe(
      false,
    )
    expect(sameFeedsUrl('https://example.com/feed?token=Ab', 'https://example.com/feed?token=ab')).toBe(false)
  })

  test('ignores the scheme, as servers serve one calendar over http and https', () => {
    expect(sameFeedsUrl('http://example.com/cal', 'https://example.com/cal')).toBe(true)
  })

  test('ignores the port its scheme uses by default', () => {
    expect(sameFeedsUrl('https://example.com:443/cal.ics', 'https://example.com/cal.ics')).toBe(true)
    expect(sameFeedsUrl('http://example.com:80/cal.ics', 'https://example.com/cal.ics')).toBe(true)
    expect(sameFeedsUrl('http://example.com:443/cal.ics', 'https://example.com/cal.ics')).toBe(false)
  })

  test('tells apart another host or port', () => {
    expect(sameFeedsUrl('https://example.com/cal', 'https://example.org/cal')).toBe(false)
    expect(sameFeedsUrl('https://example.com:8443/cal', 'https://example.com/cal')).toBe(false)
  })
})

describe('nextFeedsColour', () => {
  test('takes a colour no subscription has yet', () => {
    expect(nextFeedsColour([])).toBe('blue')
    expect(nextFeedsColour(['blue'])).toBe('teal')
    expect(nextFeedsColour(['teal', 'blue'])).toBe('purple')
  })

  test('goes round again once every colour is taken', () => {
    expect(nextFeedsColour([...FEEDS_COLOURS])).toBe('blue')
    expect(nextFeedsColour([...FEEDS_COLOURS, 'blue'])).toBe('teal')
  })
})

describe('toFeedsName', () => {
  test('is trimmed', () => {
    expect(toFeedsName('  Holidays ')).toBe('Holidays')
  })

  test('refuses an empty one, a long one, and what is not text', () => {
    expect(toFeedsName('   ')).toBeNull()
    expect(toFeedsName('x'.repeat(201))).toBeNull()
    expect(toFeedsName(null)).toBeNull()
  })
})
