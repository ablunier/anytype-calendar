import { describe, expect, test } from 'vitest'
import { toCreateRequest, toRescheduleRequest, toSetDoneRequest } from './edit-requests'

const day = { year: 2026, month: 8, day: 16 }

describe('a reschedule', () => {
  test('keeps the ids and a well-formed change, and nothing else', () => {
    expect(
      toRescheduleRequest({
        spaceId: 'sp_1',
        id: 'obj_1',
        change: { kind: 'move', start: { day, minute: 600 } },
        extra: true
      })
    ).toEqual({ spaceId: 'sp_1', id: 'obj_1', change: { kind: 'move', start: { day, minute: 600 } } })
  })

  test('refuses a missing id or a malformed change', () => {
    const change = { kind: 'move', start: { day, minute: 600 } }
    expect(toRescheduleRequest({ spaceId: 'sp_1', id: '', change })).toBeNull()
    expect(toRescheduleRequest({ id: 'obj_1', change })).toBeNull()
    expect(toRescheduleRequest({ spaceId: 'sp_1', id: 'obj_1', change: { kind: 'move', start: { day } } })).toBeNull()
    expect(toRescheduleRequest('obj_1')).toBeNull()
  })
})

describe('a creation', () => {
  test('takes a type, a name, which may be empty, and a slot', () => {
    const request = { spaceId: 'sp_1', typeKey: 'meeting', name: '', at: { day, minute: null } }
    expect(toCreateRequest(request)).toEqual(request)
  })

  test('refuses a name longer than Anytype takes, or no slot', () => {
    expect(
      toCreateRequest({ spaceId: 'sp_1', typeKey: 'meeting', name: 'x'.repeat(4097), at: { day, minute: null } })
    ).toBeNull()
    expect(toCreateRequest({ spaceId: 'sp_1', typeKey: 'meeting', name: 'x' })).toBeNull()
    expect(toCreateRequest({ spaceId: 'sp_1', name: 'x', at: { day, minute: null } })).toBeNull()
  })
})

describe('setting Done', () => {
  test('takes a boolean only', () => {
    expect(toSetDoneRequest({ spaceId: 'sp_1', id: 'obj_1', done: false })).toEqual({
      spaceId: 'sp_1',
      id: 'obj_1',
      done: false
    })
    expect(toSetDoneRequest({ spaceId: 'sp_1', id: 'obj_1', done: 'yes' })).toBeNull()
  })
})
