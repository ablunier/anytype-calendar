import type { AnytypeDialectProbe } from '@anytype-calendar/anytype-client/infrastructure'
import type { AuthExchangeResult, AuthGateway, AuthVerifyResult } from '../../domain'
import type { AnytypeV2AuthGateway } from './anytype-v2-auth-gateway'

/**
 * Pairs through v2 where Anytype serves it, and through v1 where it does not. A code must be
 * exchanged with the major that issued its challenge, so each challenge's is remembered; the
 * key that comes back works with both.
 */
export class AnytypeAuthGateway implements AuthGateway {
  readonly #probe: AnytypeDialectProbe
  readonly #v1: AuthGateway
  readonly #v2: AnytypeV2AuthGateway
  readonly #v1Challenges = new Set<string>()

  constructor({
    probe,
    v1,
    v2
  }: {
    probe: AnytypeDialectProbe
    v1: AuthGateway
    v2: AnytypeV2AuthGateway
  }) {
    this.#probe = probe
    this.#v1 = v1
    this.#v2 = v2
  }

  async createChallenge(appName: string): Promise<string> {
    const challengeId = await this.#v2.createChallenge(appName)
    if (challengeId !== null) return challengeId
    const v1ChallengeId = await this.#v1.createChallenge(appName)
    this.#v1Challenges.add(v1ChallengeId)
    return v1ChallengeId
  }

  async exchangeCode(challengeId: string, code: string): Promise<AuthExchangeResult> {
    if (!this.#v1Challenges.has(challengeId)) return this.#v2.exchangeCode(challengeId, code)
    const result = await this.#v1.exchangeCode(challengeId, code)
    if (result.ok) this.#v1Challenges.delete(challengeId)
    return result
  }

  /** v2's `whoami` checks the key while finding out the dialect, so it is asked only once. */
  async verifyApiKey(apiKey: string): Promise<AuthVerifyResult> {
    const probed = await this.#probe.probe(apiKey)
    if (!probed.ok) return { ok: false, failure: 'invalid-key' }
    return probed.dialect === 'v2' ? { ok: true } : this.#v1.verifyApiKey(apiKey)
  }
}
