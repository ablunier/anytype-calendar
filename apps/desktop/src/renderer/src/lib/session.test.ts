import { describe, expect, test } from 'vitest'
import type { SessionSnapshot } from '@shared/ipc'
import { apiKeyFor, authViewFor } from './session'

const CHALLENGE = { id: 'ch_1', expiresAt: 60_000 }
const ATTEMPT = { challenge: CHALLENGE, code: '1234' }
const KEY = { hint: 'ab12', issuedAt: 1_000 }

describe('authViewFor', () => {
  test('signed-out starts the flow', () => {
    const session: SessionSnapshot = { phase: 'signed-out' }
    expect(authViewFor(session)).toEqual({ stage: 'start' })
  })

  test('awaiting-code shows the challenge', () => {
    const session: SessionSnapshot = { phase: 'awaiting-code', challenge: CHALLENGE }
    expect(authViewFor(session)).toEqual({
      stage: 'code',
      challengeId: CHALLENGE.id,
      expiresAt: CHALLENGE.expiresAt
    })
  })

  test('verifying carries the submitted code', () => {
    const session: SessionSnapshot = { phase: 'verifying', attempt: ATTEMPT }
    expect(authViewFor(session)).toEqual({ stage: 'verifying', code: ATTEMPT.code })
  })

  test('entering-key shows the paste-a-key form', () => {
    const session: SessionSnapshot = { phase: 'entering-key' }
    expect(authViewFor(session)).toEqual({ stage: 'entering-key' })
  })

  test('verifying-key shows the checking state', () => {
    const session: SessionSnapshot = { phase: 'verifying-key' }
    expect(authViewFor(session)).toEqual({ stage: 'verifying-key' })
  })

  test('failed carries the attempted code and the code origin when there was one', () => {
    const session: SessionSnapshot = { phase: 'failed', failure: 'invalid-code', attempt: ATTEMPT }
    expect(authViewFor(session)).toEqual({
      stage: 'error',
      failure: 'invalid-code',
      code: ATTEMPT.code,
      origin: 'code'
    })
  })

  test('failed with no attempt carries no code, defaulting to the code origin', () => {
    const session: SessionSnapshot = { phase: 'failed', failure: 'unreachable' }
    expect(authViewFor(session)).toEqual({
      stage: 'error',
      failure: 'unreachable',
      code: undefined,
      origin: 'code'
    })
  })

  test('failed after entering a key carries the key origin and no code', () => {
    const session: SessionSnapshot = {
      phase: 'failed',
      failure: 'invalid-key',
      enteredKey: true
    }
    expect(authViewFor(session)).toEqual({
      stage: 'error',
      failure: 'invalid-key',
      code: undefined,
      origin: 'key'
    })
  })

  test('connected has no auth view', () => {
    const session: SessionSnapshot = { phase: 'connected', key: KEY, access: null }
    expect(authViewFor(session)).toBeNull()
  })
})

describe('apiKeyFor', () => {
  test('connected exposes the key hint', () => {
    const session: SessionSnapshot = { phase: 'connected', key: KEY, access: null }
    expect(apiKeyFor(session)).toEqual({ hint: KEY.hint, issuedAt: KEY.issuedAt })
  })

  test('every other phase has no key to show', () => {
    const sessions: SessionSnapshot[] = [
      { phase: 'signed-out' },
      { phase: 'awaiting-code', challenge: CHALLENGE },
      { phase: 'verifying', attempt: ATTEMPT },
      { phase: 'entering-key' },
      { phase: 'verifying-key' },
      { phase: 'failed', failure: 'expired', attempt: ATTEMPT }
    ]
    for (const session of sessions) expect(apiKeyFor(session)).toBeNull()
  })
})
