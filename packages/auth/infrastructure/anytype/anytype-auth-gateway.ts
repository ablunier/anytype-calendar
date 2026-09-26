import type {
  AnytypeDialectProbe,
  AnytypeDialectResult
} from '@anytype-calendar/anytype-client/infrastructure'
import type { AuthAccess, AuthExchangeResult, AuthGateway, AuthVerifyResult } from '../../domain'
import { grantFromWhoami } from './anytype-grant'
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

  /**
   * The access is the probe's, not the exchange's: the reads that follow go through whichever
   * major the probe picks, which a forced v1 makes v1 even for a key paired through v2.
   */
  async exchangeCode(challengeId: string, code: string): Promise<AuthExchangeResult> {
    const issuedByV1 = this.#v1Challenges.has(challengeId)
    const result = await (issuedByV1 ? this.#v1 : this.#v2).exchangeCode(challengeId, code)
    if (!result.ok) return result
    if (issuedByV1) this.#v1Challenges.delete(challengeId)
    return { ...result, access: await this.#probedAccess(result.apiKey, result.access) }
  }

  /**
   * v2's `whoami` checks the key while finding out the dialect, so it is asked only once. It is
   * asked afresh every time, since the user may have changed the key's grant in Anytype.
   */
  async verifyApiKey(apiKey: string): Promise<AuthVerifyResult> {
    this.#probe.forget()
    const probed = await this.#probe.probe(apiKey)
    if (!probed.ok) return { ok: false, failure: 'invalid-key' }
    return probed.dialect === 'v2'
      ? { ok: true, access: accessOf(probed) }
      : this.#v1.verifyApiKey(apiKey)
  }

  /** A key Anytype has just issued is not refused; should the probe fail anyway, `fallback` stands. */
  async #probedAccess(apiKey: string, fallback: AuthAccess): Promise<AuthAccess> {
    try {
      const probed = await this.#probe.probe(apiKey)
      return probed.ok ? accessOf(probed) : fallback
    } catch {
      return fallback
    }
  }
}

function accessOf(probed: Extract<AnytypeDialectResult, { ok: true }>): AuthAccess {
  return probed.dialect === 'v2'
    ? { apiVersion: 'v2', grant: grantFromWhoami(probed.whoami) }
    : { apiVersion: 'v1', grant: null }
}
