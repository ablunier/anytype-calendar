import { expect, test } from 'vitest'
import { apiKeyHint, describeCredential } from './credential'

test('the hint is the last four characters of the key', () => {
  expect(apiKeyHint('ak_0123456789abcdef4c19')).toBe('4c19')
})

test('describing a credential keeps the hint and date, and drops the key itself', () => {
  const info = describeCredential({ apiKey: 'ak_0123456789abcdef4c19', issuedAt: 42 })

  expect(info).toEqual({ hint: '4c19', issuedAt: 42 })
  expect(JSON.stringify(info)).not.toContain('ak_')
})
