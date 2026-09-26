/** The Anytype desktop app's local API. */
export const ANYTYPE_LOCAL_API_URL = 'http://127.0.0.1:31009'

/** Sent as the `Anytype-Version` header; the API answers in the shape of this version. */
export const ANYTYPE_API_VERSION = '2025-11-08'

/** The subset of `fetch` the client uses, so the package needs neither DOM nor Node types. */
export type AnytypeFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string }
) => Promise<{ status: number; text(): Promise<string> }>

export interface AnytypeClientOptions {
  fetch: AnytypeFetch
  baseUrl?: string
  apiVersion?: string
}

export interface AnytypeRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** From the API root, e.g. `/v1/spaces`. */
  path: string
  /** Sent as JSON. */
  body?: unknown
  /** Sent as a bearer token; omitted only by the auth endpoints. */
  apiKey?: string
  /** Extra request headers, e.g. v2's `Idempotency-Key`. */
  headers?: Record<string, string>
}

/** Empty strings when the error body did not carry the field. */
export interface AnytypeApiError {
  /** e.g. `bad_request`, `internal_server_error`. */
  code: string
  message: string
}

export type AnytypeResponse =
  | { ok: true; status: number; body: unknown }
  | { ok: false; status: number; error: AnytypeApiError }

/**
 * An error status is an answer, not a failure, so it resolves as a value for the adapter
 * to interpret; only a transport breakdown — no connection, or a success whose body is not
 * JSON — rejects. Bodies are returned unvalidated: each adapter checks the shape
 * it relies on.
 */
export class AnytypeClient {
  readonly #fetch: AnytypeFetch
  readonly #baseUrl: string
  readonly #apiVersion: string

  constructor({
    fetch,
    baseUrl = ANYTYPE_LOCAL_API_URL,
    apiVersion = ANYTYPE_API_VERSION
  }: AnytypeClientOptions) {
    this.#fetch = fetch
    this.#baseUrl = baseUrl
    this.#apiVersion = apiVersion
  }

  async request({ method, path, body, apiKey, headers: extra }: AnytypeRequest): Promise<AnytypeResponse> {
    // v2 routes ignore the version header, so it is sent to both majors alike.
    const headers: Record<string, string> = { ...extra, 'Anytype-Version': this.#apiVersion }
    if (apiKey !== undefined) headers['Authorization'] = `Bearer ${apiKey}`
    const init: Parameters<AnytypeFetch>[1] = { method, headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    const response = await this.#fetch(`${this.#baseUrl}${path}`, init)
    const text = await response.text()

    if (response.status >= 200 && response.status < 300) {
      return { ok: true, status: response.status, body: text === '' ? null : JSON.parse(text) }
    }
    return { ok: false, status: response.status, error: toApiError(parseErrorBody(text)) }
  }
}

/**
 * An unmatched route answers in plain text (`404 page not found`), which is still an answer:
 * an Anytype without API v2 says so this way.
 */
function parseErrorBody(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * v1's error body is `{ object: 'error', status, code, message }`; v2's handlers answer
 * `{ status, code, message, issues }`, though its auth and scope checks still use v1's.
 */
function toApiError(body: unknown): AnytypeApiError {
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  return {
    code: typeof fields['code'] === 'string' ? fields['code'] : '',
    message: typeof fields['message'] === 'string' ? fields['message'] : ''
  }
}
