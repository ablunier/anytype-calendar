import type { AnytypeClient } from '@anytype-calendar/anytype-client/infrastructure'
import type { AuthExchangeResult, AuthGateway, AuthVerifyResult } from '../../domain'

/**
 * Anytype answers a wrong code, an expired challenge and an unknown challenge alike with
 * 500 "failed to authenticate user" (anytype-heart ErrFailedAuthenticate); 400 means a
 * missing field. Those are the only errors the endpoint documents, so both read as a
 * rejected code, and anything else as Anytype misbehaving.
 */
const REJECTED_CODE_STATUSES = new Set([400, 500])

/** What every authenticated endpoint answers for a key it does not recognise. */
const UNAUTHORIZED = 401

export class AnytypeV1AuthGateway implements AuthGateway {
  readonly #client: AnytypeClient

  constructor(client: AnytypeClient) {
    this.#client = client
  }

  async createChallenge(appName: string): Promise<string> {
    const response = await this.#client.request({
      method: 'POST',
      path: '/v1/auth/challenges',
      body: { app_name: appName }
    })
    const challengeId = response.ok ? stringField(response.body, 'challenge_id') : undefined
    if (challengeId === undefined) throw unexpected('challenge', response)
    return challengeId
  }

  async exchangeCode(challengeId: string, code: string): Promise<AuthExchangeResult> {
    const response = await this.#client.request({
      method: 'POST',
      path: '/v1/auth/api_keys',
      body: { challenge_id: challengeId, code }
    })
    if (!response.ok && REJECTED_CODE_STATUSES.has(response.status)) {
      return { ok: false, failure: 'invalid-code' }
    }
    const apiKey = response.ok ? stringField(response.body, 'api_key') : undefined
    if (apiKey === undefined) throw unexpected('API key', response)
    return { ok: true, apiKey }
  }

  /**
   * The local API has no "whoami" endpoint, so this asks for something only a valid key
   * can read; the body is ignored — only whether Anytype accepted the key matters.
   */
  async verifyApiKey(apiKey: string): Promise<AuthVerifyResult> {
    const response = await this.#client.request({ method: 'GET', path: '/v1/spaces', apiKey })
    if (response.ok) return { ok: true }
    if (response.status === UNAUTHORIZED) return { ok: false, failure: 'invalid-key' }
    throw unexpected('spaces list', response)
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
