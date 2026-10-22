import { toEventsReschedule, toEventsSlot } from '@anytype-calendar/events/domain'
import type { EventsCreateRequest, EventsRescheduleRequest, EventsSetDoneRequest } from '@shared/ipc'

/** The longest name Anytype takes for an object. */
const MAX_NAME_LENGTH = 4096

/* Renderer input is untrusted, and each of these becomes a write to the user's Anytype, so
 * every field is checked here and nothing but the fields is passed on. Each is null unless
 * `value` is a well-formed request. */

export function toRescheduleRequest(value: unknown): EventsRescheduleRequest | null {
  const fields = fieldsOf(value)
  const change = toEventsReschedule(fields['change'])
  const { spaceId, id } = fields
  return isId(spaceId) && isId(id) && change ? { spaceId, id, change } : null
}

/** `collectionId` is not checked against the sync: Anytype answers an unknown one with 404. */
export function toCreateRequest(value: unknown): EventsCreateRequest | null {
  const fields = fieldsOf(value)
  const at = toEventsSlot(fields['at'])
  const { spaceId, typeKey, name, collectionId } = fields
  const named = typeof name === 'string' && name.length <= MAX_NAME_LENGTH
  if (!isId(spaceId) || !isId(typeKey) || !named || !at) return null
  const request = { spaceId, typeKey, name, at }
  if (collectionId === undefined) return request
  return isId(collectionId) ? { ...request, collectionId } : null
}

export function toSetDoneRequest(value: unknown): EventsSetDoneRequest | null {
  const { spaceId, id, done } = fieldsOf(value)
  return isId(spaceId) && isId(id) && typeof done === 'boolean' ? { spaceId, id, done } : null
}

function fieldsOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}
