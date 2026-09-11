import { describe, expect, test } from 'vitest'
import { createAuthChallenge } from './challenge'
import type { ApiKeyInfo } from './credential'
import { nextAuthSession, type AuthEvent, type AuthSession } from './session'

/** Frozen so a transition that mutates its input throws instead of corrupting other cases. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const challenge = createAuthChallenge('ch_1', 0)
const attempt = { challenge, code: '2749' }
const freshChallenge = createAuthChallenge('ch_2', 1_000)
const key: ApiKeyInfo = { hint: '4c19', issuedAt: 5 }

const sessions = deepFreeze({
  signedOut: { phase: 'signed-out' },
  awaitingCode: { phase: 'awaiting-code', challenge },
  verifying: { phase: 'verifying', attempt },
  failedAttempt: { phase: 'failed', failure: 'invalid-code', attempt },
  failedUnreachable: { phase: 'failed', failure: 'unreachable' },
  connected: { phase: 'connected', key }
} satisfies Record<string, AuthSession>)

const events = deepFreeze({
  challengeIssued: { type: 'challenge-issued', challenge: freshChallenge },
  challengeFailed: { type: 'challenge-failed' },
  codeSubmitted: { type: 'code-submitted', code: '2749', at: 1_000 },
  exchangeSucceeded: { type: 'exchange-succeeded', key },
  exchangeFailed: { type: 'exchange-failed', failure: 'invalid-code' },
  steppedBack: { type: 'stepped-back' },
  restored: { type: 'restored', key },
  signedOut: { type: 'signed-out' }
} satisfies Record<string, AuthEvent>)

type SessionName = keyof typeof sessions
type EventName = keyof typeof events

/** Every transition that changes the session. Any pair not listed here must be ignored. */
const transitions: Array<[SessionName, EventName, AuthSession]> = [
  ['signedOut', 'challengeIssued', { phase: 'awaiting-code', challenge: freshChallenge }],
  ['awaitingCode', 'challengeIssued', { phase: 'awaiting-code', challenge: freshChallenge }],
  ['failedAttempt', 'challengeIssued', { phase: 'awaiting-code', challenge: freshChallenge }],
  ['failedUnreachable', 'challengeIssued', { phase: 'awaiting-code', challenge: freshChallenge }],

  ['signedOut', 'challengeFailed', { phase: 'failed', failure: 'unreachable' }],
  ['awaitingCode', 'challengeFailed', { phase: 'failed', failure: 'unreachable' }],
  ['failedAttempt', 'challengeFailed', { phase: 'failed', failure: 'unreachable' }],
  ['failedUnreachable', 'challengeFailed', { phase: 'failed', failure: 'unreachable' }],

  ['awaitingCode', 'codeSubmitted', { phase: 'verifying', attempt }],

  ['verifying', 'exchangeSucceeded', { phase: 'connected', key }],
  ['verifying', 'exchangeFailed', { phase: 'failed', failure: 'invalid-code', attempt }],

  ['awaitingCode', 'steppedBack', { phase: 'signed-out' }],
  ['verifying', 'steppedBack', { phase: 'awaiting-code', challenge }],
  ['failedAttempt', 'steppedBack', { phase: 'awaiting-code', challenge }],
  ['failedUnreachable', 'steppedBack', { phase: 'signed-out' }],

  ['signedOut', 'restored', { phase: 'connected', key }],

  ['connected', 'signedOut', { phase: 'signed-out' }]
]

const listed = new Set(transitions.map(([session, event]) => `${session}/${event}`))
const ignored = (Object.keys(sessions) as SessionName[]).flatMap((session) =>
  (Object.keys(events) as EventName[])
    .filter((event) => !listed.has(`${session}/${event}`))
    .map((event): [SessionName, EventName] => [session, event])
)

describe('nextAuthSession', () => {
  test.each(transitions)('%s + %s moves on', (session, event, expected) => {
    expect(nextAuthSession(sessions[session], events[event])).toEqual(expected)
  })

  test.each(ignored)('%s ignores %s, returning the same object', (session, event) => {
    expect(nextAuthSession(sessions[session], events[event])).toBe(sessions[session])
  })

  test('covers every phase × event pair', () => {
    expect(transitions.length + ignored.length).toBe(
      Object.keys(sessions).length * Object.keys(events).length
    )
  })

  describe('submitting a code', () => {
    test('fails as expired once the challenge has lapsed, keeping the attempt', () => {
      const late = { type: 'code-submitted', code: '2749', at: challenge.expiresAt } as const
      expect(nextAuthSession(sessions.awaitingCode, late)).toEqual({
        phase: 'failed',
        failure: 'expired',
        attempt
      })
    })

    test('verifies right up to the last live millisecond', () => {
      const justInTime = { type: 'code-submitted', code: '2749', at: challenge.expiresAt - 1 } as const
      expect(nextAuthSession(sessions.awaitingCode, justInTime).phase).toBe('verifying')
    })

    test('ignores a malformed code', () => {
      const malformed = { type: 'code-submitted', code: '27', at: 1_000 } as const
      expect(nextAuthSession(sessions.awaitingCode, malformed)).toBe(sessions.awaitingCode)
    })
  })

  test('stepping back after an expired code returns to that challenge', () => {
    const expired = nextAuthSession(sessions.awaitingCode, {
      type: 'code-submitted',
      code: '2749',
      at: challenge.expiresAt
    })
    expect(nextAuthSession(expired, { type: 'stepped-back' })).toEqual(sessions.awaitingCode)
  })
})
