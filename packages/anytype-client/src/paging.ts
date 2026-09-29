import { AnytypeTransportError, type AnytypeResult } from './client'
import type { AnytypePage, AnytypePaging } from './types'

/** The largest page the local API serves. */
export const ANYTYPE_PAGE_LIMIT = 1_000

/**
 * Every page of a list, in order, read `ANYTYPE_PAGE_LIMIT` at a time. Stops at the first
 * refusal and answers it; `pages` keeps each page's own members, e.g. its `warnings`.
 */
export async function listAll<Page extends AnytypePage<unknown>>(
  page: (paging: Required<AnytypePaging>) => Promise<AnytypeResult<Page>>
): Promise<AnytypeResult<{ data: Page['data']; pages: Page[] }>> {
  const data: Page['data'] = []
  const pages: Page[] = []
  for (;;) {
    const result = await page({ offset: data.length, limit: ANYTYPE_PAGE_LIMIT })
    if (!result.ok) return result
    const rows: unknown = result.body?.data
    if (!Array.isArray(rows)) throw new AnytypeTransportError('Anytype answered a page without a data list')
    data.push(...rows)
    pages.push(result.body)
    // An empty page that claims more would otherwise be asked for forever.
    if (result.body.has_more !== true || rows.length === 0) {
      return { ok: true, status: result.status, body: { data, pages } }
    }
  }
}
