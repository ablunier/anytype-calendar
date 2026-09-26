import {
  isUnmatchedRoute,
  type AnytypeClient
} from '@anytype-calendar/anytype-client/infrastructure'
import type { AuthExchangeResult } from '../../domain'

/**
 * Pairing is refused before v2's own handlers run, so it answers in v1's shape and with v1's
 * statuses: a wrong code, an expired challenge and an unknown one alike come back 500 "failed
 * to authenticate user", and 400 means a missing field. Both read as a rejected code.
 */
const REJECTED_CODE_STATUSES = new Set([400, 500])

const UNAUTHORIZED = 401

/**
 * v2 pairing. Unlike v1's, it lets the user choose in Anytype which spaces the key reaches and
 * whether it may write. Only pairing lives here: a key is checked through the dialect probe,
 * whose `whoami` already answers that (see AnytypeAuthGateway).
 */
export class AnytypeV2AuthGateway {
  readonly #client: AnytypeClient

  constructor(client: AnytypeClient) {
    this.#client = client
  }

  /**
   * Null when this Anytype does not serve v2. The route needs no key there, so a refusal for
   * the lack of one means an Anytype whose key check runs before it finds no such route.
   */
  async createChallenge(appName: string): Promise<string | null> {
    const response = await this.#client.request({
      method: 'POST',
      path: '/v2/auth/challenges',
      body: { app_name: appName }
    })
    if (isUnmatchedRoute(response) || response.status === UNAUTHORIZED) return null
    const challengeId = response.ok ? stringField(response.body, 'challenge_id') : undefined
    if (challengeId === undefined) throw unexpected('challenge', response)
    return challengeId
  }

  async exchangeCode(challengeId: string, code: string): Promise<AuthExchangeResult> {
    const response = await this.#client.request({
      method: 'POST',
      path: '/v2/auth/api_keys',
      body: { challenge_id: challengeId, code }
    })
    if (!response.ok && REJECTED_CODE_STATUSES.has(response.status)) {
      return { ok: false, failure: 'invalid-code' }
    }
    const apiKey = response.ok ? stringField(response.body, 'api_key') : undefined
    if (apiKey === undefined) throw unexpected('API key', response)
    return { ok: true, apiKey }
  }
}

function stringField(body: unknown, name: string): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const value = (body as Record<string, unknown>)[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Carries the status only: a response body could echo the key. */
function unexpected(what: string, response: { status: number }): Error {
  return new Error(`Anytype answered ${response.status} without a usable ${what}`)
}
