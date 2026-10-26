import { expect, test, vi } from 'vitest'
import { HttpFeedsGateway, type FeedsFetch } from './http-feeds-gateway'

const respond = (status: number, body = ''): FeedsFetch =>
  vi.fn(async () => ({ ok: status >= 200 && status < 300, status, text: async () => body }))

test('answers the body of a feed', async () => {
  const fetch = respond(200, 'BEGIN:VCALENDAR')
  await expect(new HttpFeedsGateway(fetch).fetch('https://example.com/a.ics')).resolves.toEqual({
    ok: true,
    text: 'BEGIN:VCALENDAR'
  })
  expect(fetch).toHaveBeenCalledWith('https://example.com/a.ics', {
    headers: { Accept: 'text/calendar, */*;q=0.5' }
  })
})

test('answers the status of an error', async () => {
  await expect(new HttpFeedsGateway(respond(404)).fetch('https://example.com/a.ics')).resolves.toEqual({
    ok: false,
    failure: 'http',
    status: 404
  })
})

test('answers unreachable when no answer came, or the body was cut off', async () => {
  const refused: FeedsFetch = async () => {
    throw new TypeError('fetch failed')
  }
  const cut: FeedsFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => {
      throw new Error('aborted')
    }
  })
  for (const fetch of [refused, cut]) {
    await expect(new HttpFeedsGateway(fetch).fetch('https://example.com/a.ics')).resolves.toEqual({
      ok: false,
      failure: 'unreachable'
    })
  }
})
