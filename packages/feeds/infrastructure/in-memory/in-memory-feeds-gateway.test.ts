import { expect, test } from 'vitest'
import { IcalFeedsCalendarParser } from '../ical/ical-feeds-calendar-parser'
import { LocalFeedsTimeZone } from '../local-time/local-feeds-time-zone'
import { InMemoryFeedsGateway } from './in-memory-feeds-gateway'

const NOW = new Date(2026, 8, 10, 12).getTime()
const gateway = new InMemoryFeedsGateway({ sleep: async () => {}, now: () => NOW })

test('answers a sample the real parser reads, around the current month', async () => {
  const result = await gateway.fetch('https://example.com/team.ics')
  if (!result.ok) throw new Error('not answered')
  const calendar = new IcalFeedsCalendarParser(new LocalFeedsTimeZone()).parse(result.text)
  expect(calendar?.name).toBe('Sample team calendar')
  const september = { start: new Date(2026, 8, 1).getTime(), end: new Date(2026, 9, 1).getTime() - 1 }
  const titles = calendar?.occurrencesIn(september).map(({ title }) => title) ?? []
  expect(titles).toContain('Company holiday')
  expect(titles).toContain('Call with the New York office')
  expect(titles.filter((title) => title.startsWith('Weekly team sync')).length).toBeGreaterThanOrEqual(3)
})

test('answers a page that is not a calendar for any other address', async () => {
  await expect(gateway.fetch('https://example.com/team')).resolves.toMatchObject({ ok: true })
  await expect(gateway.fetch('https://unreachable.example/team.ics')).resolves.toEqual({
    ok: false,
    failure: 'unreachable'
  })
})
