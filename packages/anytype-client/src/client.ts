import type {
  AnytypeApiKey,
  AnytypeChallenge,
  AnytypeCreated,
  AnytypeEdited,
  AnytypeFile,
  AnytypeObjectCreate,
  AnytypeObjectDocument,
  AnytypeObjectOp,
  AnytypeObjectRow,
  AnytypeOptionRow,
  AnytypePage,
  AnytypePaging,
  AnytypeSearchRequest,
  AnytypeSpacePage,
  AnytypeTypeDocument,
  AnytypeTypeRow,
  AnytypeView,
  AnytypeWhoami
} from './types'

/** The Anytype desktop app's local API. */
export const ANYTYPE_LOCAL_API_URL = 'http://127.0.0.1:31009'

/** The subset of `fetch` the client uses: the platform's own `fetch` is one. */
export type AnytypeFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string }
) => Promise<AnytypeFetchResponse>

export interface AnytypeFetchResponse {
  status: number
  headers: { get(name: string): string | null }
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface AnytypeClientOptions {
  /** Defaults to the global `fetch`. Pass one to add a timeout, a proxy or a test double. */
  fetch?: AnytypeFetch
  baseUrl?: string
  /** Makes each write's `Idempotency-Key`. Defaults to `crypto.randomUUID`. */
  randomId?: () => string
  /**
   * Called whenever a route answers the bare plain-text 404 of an Anytype build without it,
   * e.g. to notice that Anytype was downgraded to a build without v2.
   */
  onUnsupported?: () => void
}

export type AnytypeMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export type AnytypeQuery = Record<string, string | number | boolean | readonly string[] | undefined>

/** A request to any route, for one the client has no method for yet. */
export interface AnytypeRequest {
  method: AnytypeMethod
  /** From the API root, e.g. `/v2/spaces`. */
  path: string
  /** Sent in this order; an array is sent comma-separated. */
  query?: AnytypeQuery
  /** Sent as JSON. */
  body?: unknown
  /** Sent as a bearer token. */
  apiKey?: string
  headers?: Record<string, string>
  /**
   * Sends an `Idempotency-Key`, and sends the request once more with it if the first got no
   * answer, so Anytype replays rather than repeats a write that did land.
   */
  idempotent?: boolean
}

/** Empty strings, and no issues, when the error body did not carry the field. */
export interface AnytypeApiError {
  /** e.g. `bad_request`, `space_not_granted`, `write_not_granted`. */
  code: string
  message: string
  /** Which input was refused, and why. */
  issues: AnytypeApiErrorIssue[]
}

export interface AnytypeApiErrorIssue {
  /** Empty when the issue names no input. */
  path: string
  message: string
}

export type AnytypeFailure = {
  ok: false
  status: number
  error: AnytypeApiError
  /** The route does not exist in this Anytype build (see `isUnmatchedRoute`). */
  unsupported: boolean
}

/**
 * An error status is an answer, not a failure, so it resolves as a value; only a transport
 * breakdown rejects, with an `AnytypeTransportError`. Bodies are typed but not validated.
 */
export type AnytypeResult<T> = { ok: true; status: number; body: T } | AnytypeFailure

/** No connection, no answer, or a success whose body is not JSON. */
export class AnytypeTransportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AnytypeTransportError'
  }
}

const NOT_FOUND = 404

export class AnytypeClient {
  readonly #fetch: AnytypeFetch
  readonly #baseUrl: string
  readonly #randomId: () => string
  readonly #onUnsupported: () => void

  /** Pairing: the routes that need no key. */
  readonly auth = {
    /** Anytype shows the user a 4-digit code for the challenge. */
    createChallenge: ({ appName }: { appName: string }): Promise<AnytypeResult<AnytypeChallenge>> =>
      this.request({ method: 'POST', path: '/v2/auth/challenges', body: { app_name: appName } }),

    /**
     * The user picks in Anytype which spaces the key reaches, and whether it may write. A wrong
     * code, an expired challenge and an unknown one alike answer 500; a missing field 400.
     */
    createApiKey: ({ challengeId, code }: { challengeId: string; code: string }): Promise<AnytypeResult<AnytypeApiKey>> =>
      this.request({ method: 'POST', path: '/v2/auth/api_keys', body: { challenge_id: challengeId, code } })
  }

  constructor({ fetch, baseUrl = ANYTYPE_LOCAL_API_URL, randomId, onUnsupported }: AnytypeClientOptions = {}) {
    const platform = globalThis as { fetch?: AnytypeFetch; crypto?: { randomUUID?: () => string } }
    this.#fetch =
      fetch ??
      ((url, init) => {
        if (!platform.fetch) throw new Error('No global fetch: pass one to AnytypeClient')
        return platform.fetch(url, init)
      })
    this.#baseUrl = baseUrl
    this.#randomId =
      randomId ??
      (() => {
        if (!platform.crypto?.randomUUID) throw new Error('No crypto.randomUUID: pass randomId to AnytypeClient')
        return platform.crypto.randomUUID()
      })
    this.#onUnsupported = onUnsupported ?? (() => {})
  }

  /** Cheap: make one per call where the key can change. */
  withApiKey(apiKey: string): AnytypeApi {
    return new AnytypeApi(this, apiKey)
  }

  async request<T = unknown>(request: AnytypeRequest): Promise<AnytypeResult<T>> {
    const response = await this.#send(request)
    const text = await read(() => response.text())
    if (isSuccess(response.status)) {
      return { ok: true, status: response.status, body: (text === '' ? null : parseSuccess(text)) as T }
    }
    return this.#failure(response.status, text)
  }

  /** A file's bytes. The body of a success is not read as JSON. */
  async download(request: Omit<AnytypeRequest, 'method' | 'body' | 'idempotent'>): Promise<AnytypeResult<AnytypeFile>> {
    const response = await this.#send({ ...request, method: 'GET' })
    if (!isSuccess(response.status)) return this.#failure(response.status, await read(() => response.text()))
    return {
      ok: true,
      status: response.status,
      body: {
        contentType: response.headers.get('Content-Type'),
        bytes: new Uint8Array(await read(() => response.arrayBuffer()))
      }
    }
  }

  async #send({ method, path, query, body, apiKey, headers: extra, idempotent }: AnytypeRequest): Promise<AnytypeFetchResponse> {
    const headers: Record<string, string> = { ...extra }
    if (apiKey !== undefined) headers['Authorization'] = `Bearer ${apiKey}`
    if (idempotent) headers['Idempotency-Key'] = this.#randomId()
    const init: Parameters<AnytypeFetch>[1] = { method, headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const url = `${this.#baseUrl}${path}${queryString(query)}`
    try {
      return await this.#fetch(url, init)
    } catch (error) {
      if (!idempotent) throw unreachable(error)
      try {
        return await this.#fetch(url, init)
      } catch (again) {
        throw unreachable(again)
      }
    }
  }

  #failure(status: number, text: string): AnytypeFailure {
    const error = toApiError(parseErrorBody(text))
    const unsupported = status === NOT_FOUND && error.code === ''
    if (unsupported) this.#onUnsupported()
    return { ok: false, status, error, unsupported }
  }
}

/**
 * The routes that need a key, bound to one. Every id the API serves is asked for in full
 * (`ids=full`), since the short default can become ambiguous when the account joins a space.
 */
export class AnytypeApi {
  readonly #client: AnytypeClient
  readonly #apiKey: string

  constructor(client: AnytypeClient, apiKey: string) {
    this.#client = client
    this.#apiKey = apiKey
  }

  readonly auth = {
    /** Describes the key: whether it is legacy or scoped, and what it was granted. */
    whoami: ({ spaces = false }: { spaces?: boolean } = {}): Promise<AnytypeResult<AnytypeWhoami>> =>
      this.#get('/v2/auth/whoami', { ids: 'full', spaces: spaces || undefined })
  }

  readonly spaces = {
    list: (paging?: AnytypePaging): Promise<AnytypeResult<AnytypeSpacePage>> =>
      this.#get('/v2/spaces', { ids: 'full', ...paging })
  }

  readonly types = {
    list: (spaceId: string, paging?: AnytypePaging): Promise<AnytypeResult<AnytypePage<AnytypeTypeRow>>> =>
      this.#get(`${space(spaceId)}/types`, { ...paging }),

    /** An unknown type answers 404; a space outside the key's grant 403. */
    get: (spaceId: string, typeKey: string): Promise<AnytypeResult<AnytypeTypeDocument>> =>
      this.#get(`${space(spaceId)}/types/${encodeURIComponent(typeKey)}`)
  }

  readonly properties = {
    /** A select's or multi-select's options. A property that is not one answers 400. */
    listOptions: (
      spaceId: string,
      propertyKey: string,
      paging?: AnytypePaging
    ): Promise<AnytypeResult<AnytypePage<AnytypeOptionRow>>> =>
      this.#get(`${space(spaceId)}/properties/${encodeURIComponent(propertyKey)}/options`, { ...paging })
  }

  readonly search = {
    /** An unknown type key, or a field or filter over a key the type lacks, answers 400. */
    inSpace: (
      spaceId: string,
      search: AnytypeSearchRequest,
      paging?: AnytypePaging
    ): Promise<AnytypeResult<AnytypePage<AnytypeObjectRow>>> =>
      this.#call({ method: 'POST', path: `${space(spaceId)}/search`, query: { ...paging }, body: search })
  }

  readonly queries = {
    /** Anytype refuses to delete a query's last view, so every live query has one. */
    listViews: (spaceId: string, queryId: string, paging?: AnytypePaging): Promise<AnytypeResult<AnytypePage<AnytypeView>>> =>
      this.#get(`${query(spaceId, queryId)}/views`, { ...paging }),

    /**
     * The query's objects through one view's filters, and no others. Without a view the first
     * applies, with a warning at `view` naming it. `fields` are checked against the space's
     * properties; an unknown view answers 404.
     */
    listObjects: (
      spaceId: string,
      queryId: string,
      { view, fields }: { view?: string; fields?: readonly string[] } = {},
      paging?: AnytypePaging
    ): Promise<AnytypeResult<AnytypePage<AnytypeObjectRow>>> =>
      this.#get(`${query(spaceId, queryId)}/objects`, { view, fields, ...paging })
  }

  readonly objects = {
    get: (
      spaceId: string,
      objectId: string,
      { include }: { include?: 'properties' | (string & {}) } = {}
    ): Promise<AnytypeResult<AnytypeObjectDocument>> =>
      this.#get(`${space(spaceId)}/objects/${encodeURIComponent(objectId)}`, { include }),

    /** A read-only key answers 403 `write_not_granted`; a busy one 429. */
    create: (spaceId: string, object: AnytypeObjectCreate): Promise<AnytypeResult<AnytypeCreated>> =>
      this.#call({ method: 'POST', path: `${space(spaceId)}/objects`, body: object, idempotent: true }),

    /**
     * The ops apply in order as one edit: if any is refused, none is. No `If-Match` is sent, so
     * the last write wins.
     */
    update: (spaceId: string, objectId: string, ops: readonly AnytypeObjectOp[]): Promise<AnytypeResult<AnytypeEdited>> =>
      this.#call({
        method: 'PATCH',
        path: `${space(spaceId)}/objects/${encodeURIComponent(objectId)}`,
        body: { ops },
        idempotent: true
      })
  }

  readonly files = {
    /** `width` asks for an image scaled to that many pixels. */
    content: (spaceId: string, fileId: string, { width }: { width?: number } = {}): Promise<AnytypeResult<AnytypeFile>> =>
      this.#client.download({
        path: `${space(spaceId)}/files/${encodeURIComponent(fileId)}/content`,
        query: { width },
        apiKey: this.#apiKey
      })
  }

  #get<T>(path: string, query?: AnytypeQuery): Promise<AnytypeResult<T>> {
    return this.#call(query === undefined ? { method: 'GET', path } : { method: 'GET', path, query })
  }

  #call<T>(request: Omit<AnytypeRequest, 'apiKey'>): Promise<AnytypeResult<T>> {
    return this.#client.request<T>({ ...request, apiKey: this.#apiKey })
  }
}

/**
 * An Anytype build without a route answers a bare 404 with no error envelope. A handler's own
 * 404 (an unknown space, type or object) always carries a `code`, so the two cannot be confused.
 */
export function isUnmatchedRoute(result: AnytypeResult<unknown>): boolean {
  return !result.ok && result.unsupported
}

function space(spaceId: string): string {
  return `/v2/spaces/${encodeURIComponent(spaceId)}`
}

function query(spaceId: string, queryId: string): string {
  return `${space(spaceId)}/queries/${encodeURIComponent(queryId)}`
}

function queryString(query: AnytypeQuery | undefined): string {
  const pairs = Object.entries(query ?? {}).flatMap(([name, value]) => {
    if (value === undefined) return []
    const text = typeof value === 'object' ? value.map(encodeURIComponent).join(',') : encodeURIComponent(String(value))
    return [`${encodeURIComponent(name)}=${text}`]
  })
  return pairs.length === 0 ? '' : `?${pairs.join('&')}`
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300
}

async function read<T>(body: () => Promise<T>): Promise<T> {
  try {
    return await body()
  } catch (error) {
    throw unreachable(error)
  }
}

function parseSuccess(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new AnytypeTransportError('Anytype answered a success that is not JSON', { cause: error })
  }
}

function unreachable(cause: unknown): AnytypeTransportError {
  const reason = cause instanceof Error ? cause.message : String(cause)
  return new AnytypeTransportError(`Anytype could not be reached: ${reason}`, { cause })
}

/** An unmatched route answers in plain text (`404 page not found`), which is still an answer. */
function parseErrorBody(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * v2's handlers answer `{ status, code, message, issues }`; its pairing, key and rate-limit
 * checks still answer v1's `{ object: 'error', status, code, message }`.
 */
function toApiError(body: unknown): AnytypeApiError {
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  return {
    code: stringIn(fields, 'code'),
    message: stringIn(fields, 'message'),
    issues: (Array.isArray(fields['issues']) ? fields['issues'] : []).flatMap((issue: unknown) => {
      const issueFields =
        typeof issue === 'object' && issue !== null ? (issue as Record<string, unknown>) : {}
      const message = stringIn(issueFields, 'message')
      return message === '' ? [] : [{ path: stringIn(issueFields, 'path'), message }]
    })
  }
}

function stringIn(fields: Record<string, unknown>, name: string): string {
  const value = fields[name]
  return typeof value === 'string' ? value : ''
}
