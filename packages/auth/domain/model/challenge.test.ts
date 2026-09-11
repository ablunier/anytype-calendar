import { describe, expect, test } from 'vitest'
import {
  AUTH_CHALLENGE_LIFETIME_MS,
  createAuthChallenge,
  isChallengeExpired,
  isWellFormedAuthCode
} from './challenge'

describe('createAuthChallenge', () => {
  test('stamps the code lifetime onto the issue time', () => {
    expect(createAuthChallenge('ch_1', 1_000)).toEqual({
      id: 'ch_1',
      expiresAt: 1_000 + AUTH_CHALLENGE_LIFETIME_MS
    })
  })
})

describe('isChallengeExpired', () => {
  const challenge = createAuthChallenge('ch_1', 0)

  test('is live up to the last millisecond', () => {
    expect(isChallengeExpired(challenge, challenge.expiresAt - 1)).toBe(false)
  })

  test('has expired from expiresAt on', () => {
    expect(isChallengeExpired(challenge, challenge.expiresAt)).toBe(true)
    expect(isChallengeExpired(challenge, challenge.expiresAt + 1)).toBe(true)
  })
})

describe('isWellFormedAuthCode', () => {
  test.each(['2749', '0000'])('accepts %j', (code) => {
    expect(isWellFormedAuthCode(code)).toBe(true)
  })

  test.each([
    ['empty', ''],
    ['too short', '274'],
    ['too long', '27490'],
    ['non-digit', '27a9'],
    ['padded', ' 2749'],
    ['trailing newline', '2749\n'],
    ['non-ASCII digits', '٢٧٤٩']
  ])('rejects %s', (_, code) => {
    expect(isWellFormedAuthCode(code)).toBe(false)
  })
})
