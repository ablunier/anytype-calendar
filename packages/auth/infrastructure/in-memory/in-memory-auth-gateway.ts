import type { AuthExchangeResult, AuthGateway } from '../../domain'

export interface InMemoryAuthGatewayOptions {
  sleep: (ms: number) => Promise<void>
  /** Stands in for the Anytype app displaying the code to the user. */
  log: (message: string) => void
  randomId: () => string
  acceptedCode?: string
  requestLatencyMs?: number
  /** Long enough for the verifying state to be seen. */
  exchangeLatencyMs?: number
}

/**
 * Simulates the Anytype local API's auth endpoints with no I/O. Like Anytype, a wrong code
 * leaves its challenge open for another try, and a successful exchange consumes it.
 */
export class InMemoryAuthGateway implements AuthGateway {
  readonly #sleep: (ms: number) => Promise<void>
  readonly #log: (message: string) => void
  readonly #randomId: () => string
  readonly #acceptedCode: string
  readonly #requestLatencyMs: number
  readonly #exchangeLatencyMs: number
  readonly #openChallenges = new Set<string>()

  constructor({
    sleep,
    log,
    randomId,
    acceptedCode = '2749',
    requestLatencyMs = 300,
    exchangeLatencyMs = 1_200
  }: InMemoryAuthGatewayOptions) {
    this.#sleep = sleep
    this.#log = log
    this.#randomId = randomId
    this.#acceptedCode = acceptedCode
    this.#requestLatencyMs = requestLatencyMs
    this.#exchangeLatencyMs = exchangeLatencyMs
  }

  async createChallenge(appName: string): Promise<string> {
    await this.#sleep(this.#requestLatencyMs)
    const challengeId = `ch_${this.#randomId()}`
    this.#openChallenges.add(challengeId)
    this.#log(
      `[in-memory anytype] "${appName}" asks to connect — challenge ${challengeId}, code ${this.#acceptedCode}`
    )
    return challengeId
  }

  async exchangeCode(challengeId: string, code: string): Promise<AuthExchangeResult> {
    await this.#sleep(this.#exchangeLatencyMs)
    if (!this.#openChallenges.has(challengeId) || code !== this.#acceptedCode) {
      return { ok: false, failure: 'invalid-code' }
    }
    this.#openChallenges.delete(challengeId)
    return { ok: true, apiKey: `ak_mock_${this.#randomId()}` }
  }
}
