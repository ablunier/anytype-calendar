import {
  ANYTYPE_PAGE_LIMIT,
  AnytypeTransportError,
  type AnytypeClient,
  type AnytypePaging,
  type AnytypeResult
} from '@ablunier/anytype-client'

/** Sent as the `Anytype-Version` header; v1 answers in the shape of this version. */
export const ANYTYPE_V1_API_VERSION = '2025-11-08'

/** Rows are left unknown: each v1 gateway checks the shape it relies on. */
export interface AnytypeV1Page {
  data: unknown[]
  pagination: { has_more: boolean }
}

/**
 * The v1 routes the app still reads, through the same client v2 goes through. A key paired
 * through v2 (scoped) is refused here; a legacy key works with both.
 */
export class AnytypeV1Client {
  readonly #client: AnytypeClient

  constructor(client: AnytypeClient) {
    this.#client = client
  }

  readonly auth = {
    createChallenge: ({ appName }: { appName: string }): Promise<AnytypeResult<unknown>> =>
      this.#request({ method: 'POST', path: '/v1/auth/challenges', body: { app_name: appName } }),

    createApiKey: ({ challengeId, code }: { challengeId: string; code: string }): Promise<AnytypeResult<unknown>> =>
      this.#request({ method: 'POST', path: '/v1/auth/api_keys', body: { challenge_id: challengeId, code } })
  }

  readonly spaces = {
    list: (apiKey: string, paging?: AnytypePaging): Promise<AnytypeResult<AnytypeV1Page>> =>
      this.#request({ method: 'GET', path: '/v1/spaces', query: { ...paging }, apiKey })
  }

  readonly types = {
    list: (apiKey: string, spaceId: string, paging?: AnytypePaging): Promise<AnytypeResult<AnytypeV1Page>> =>
      this.#request({ method: 'GET', path: `${space(spaceId)}/types`, query: { ...paging }, apiKey })
  }

  readonly search = {
    /** Conditions are the short names (`gte`, `nempty` …), not the long ones the OpenAPI enum lists. */
    inSpace: (apiKey: string, spaceId: string, body: unknown, paging?: AnytypePaging): Promise<AnytypeResult<AnytypeV1Page>> =>
      this.#request({ method: 'POST', path: `${space(spaceId)}/search`, query: { ...paging }, body, apiKey })
  }

  #request<T>(request: Parameters<AnytypeClient['request']>[0]): Promise<AnytypeResult<T>> {
    return this.#client.request<T>({ ...request, headers: { 'Anytype-Version': ANYTYPE_V1_API_VERSION } })
  }
}

/** v1's `listAll`: its pages say whether there are more under `pagination`. */
export async function listAllV1(
  page: (paging: Required<AnytypePaging>) => Promise<AnytypeResult<AnytypeV1Page>>
): Promise<AnytypeResult<unknown[]>> {
  const items: unknown[] = []
  for (;;) {
    const result = await page({ offset: items.length, limit: ANYTYPE_PAGE_LIMIT })
    if (!result.ok) return result
    const data: unknown = result.body?.data
    if (!Array.isArray(data)) throw new AnytypeTransportError('Anytype answered a page without a data list')
    items.push(...data)
    // An empty page that claims more would otherwise be asked for forever.
    if (result.body.pagination?.has_more !== true || data.length === 0) {
      return { ok: true, status: result.status, body: items }
    }
  }
}

function space(spaceId: string): string {
  return `/v1/spaces/${encodeURIComponent(spaceId)}`
}
