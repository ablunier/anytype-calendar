import type { AnytypeClient } from '@ablunier/anytype-client'
import type {
  AuthAccess,
  AuthChallengeResult,
  AuthExchangeResult,
  AuthGateway,
  AuthVerifyResult
} from '../../domain'
import { grantFromPairing, grantFromWhoami } from './anytype-grant'

/**
 * Pairing is refused before v2's own handlers run, so it answers in v1's shape and with v1's
 * statuses: a wrong code, an expired challenge and an unknown one alike come back 500 "failed
 * to authenticate user", and 400 means a missing field. Both read as a rejected code.
 */
const REJECTED_CODE_STATUSES = new Set([400, 500])

const UNAUTHORIZED = 401

/**
 * Pairs through v2, which lets the user choose in Anytype which spaces the key reaches and
 * whether it may write. An Anytype that answers v2's routes as if they did not exist (the
 * client's `unsupported`) is too old to read through.
 */
export class AnytypeAuthGateway implements AuthGateway {
  readonly #client: AnytypeClient

  constructor(client: AnytypeClient) {
    this.#client = client
  }

  /**
   * The route needs no key, so a refusal for the lack of one means an Anytype whose key check
   * runs before it finds no such route.
   */
  async createChallenge(appName: string): Promise<AuthChallengeResult> {
    const response = await this.#client.auth.createChallenge({ appName })
    if (!response.ok && (response.unsupported || response.status === UNAUTHORIZED)) {
      return { ok: false, failure: 'outdated' }
    }
    const challengeId = response.ok ? nonEmpty(response.body?.challenge_id) : undefined
    if (challengeId === undefined) throw unexpected('challenge', response)
    return { ok: true, challengeId }
  }

  /** The new key is asked what it reaches; should that fail, the grant pairing answered stands. */
  async exchangeCode(challengeId: string, code: string): Promise<AuthExchangeResult> {
    const response = await this.#client.auth.createApiKey({ challengeId, code })
    if (!response.ok && response.unsupported) return { ok: false, failure: 'outdated' }
    if (!response.ok && REJECTED_CODE_STATUSES.has(response.status)) {
      return { ok: false, failure: 'invalid-code' }
    }
    const body = response.ok ? response.body : undefined
    const apiKey = nonEmpty(body?.api_key)
    if (apiKey === undefined) throw unexpected('API key', response)
    const paired: AuthAccess = { grant: grantFromPairing(body?.grant) }
    try {
      const verified = await this.verifyApiKey(apiKey)
      return { ok: true, apiKey, access: verified.ok ? verified.access : paired }
    } catch {
      return { ok: true, apiKey, access: paired }
    }
  }

  /** Asked afresh every time, since the user may have changed the key's grant in Anytype. */
  async verifyApiKey(apiKey: string): Promise<AuthVerifyResult> {
    const response = await this.#client.withApiKey(apiKey).auth.whoami({ spaces: true })
    if (response.ok) return { ok: true, access: { grant: grantFromWhoami(response.body) } }
    if (response.status === UNAUTHORIZED) return { ok: false, failure: 'invalid-key' }
    if (response.unsupported) return { ok: false, failure: 'outdated' }
    throw unexpected('answer to whoami', response)
  }
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Carries the status only: a response body could echo the key. */
function unexpected(what: string, response: { status: number }): Error {
  return new Error(`Anytype answered ${response.status} without a usable ${what}`)
}
