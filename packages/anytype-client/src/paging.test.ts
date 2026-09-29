import { describe, expect, test } from 'vitest'
import { AnytypeTransportError, type AnytypeResult } from './client'
import { ANYTYPE_PAGE_LIMIT, listAll } from './paging'
import type { AnytypePage, AnytypePaging } from './types'

type Page = AnytypePage<number>

function pager(results: AnytypeResult<Page>[]) {
  const asked: Required<AnytypePaging>[] = []
  const page = async (paging: Required<AnytypePaging>): Promise<AnytypeResult<Page>> => {
    asked.push(paging)
    const result = results[asked.length - 1]
    if (!result) throw new Error('no page scripted')
    return result
  }
  return { page, asked }
}

const ok = (body: Page): AnytypeResult<Page> => ({ ok: true, status: 200, body })

describe('listAll', () => {
  test('reads page after page until one says there are no more', async () => {
    const first = { data: [1, 2], has_more: true, warnings: [{ message: 'w' }] }
    const second = { data: [3], has_more: false }
    const { page, asked } = pager([ok(first), ok(second)])

    await expect(listAll(page)).resolves.toEqual({
      ok: true,
      status: 200,
      body: { data: [1, 2, 3], pages: [first, second] }
    })
    expect(asked).toEqual([
      { offset: 0, limit: ANYTYPE_PAGE_LIMIT },
      { offset: 2, limit: ANYTYPE_PAGE_LIMIT }
    ])
  })

  test('stops at an empty page that claims more', async () => {
    const { page, asked } = pager([ok({ data: [], has_more: true })])

    await expect(listAll(page)).resolves.toMatchObject({ ok: true, body: { data: [] } })
    expect(asked).toHaveLength(1)
  })

  test('answers the first refusal', async () => {
    const refused: AnytypeResult<Page> = {
      ok: false,
      status: 403,
      error: { code: 'space_not_granted', message: '', issues: [] },
      unsupported: false
    }
    const { page } = pager([ok({ data: [1], has_more: true }), refused])

    await expect(listAll(page)).resolves.toBe(refused)
  })

  test('rejects a page without a data list', async () => {
    const { page } = pager([ok({ has_more: false } as unknown as Page)])

    await expect(listAll(page)).rejects.toThrow(AnytypeTransportError)
  })
})
