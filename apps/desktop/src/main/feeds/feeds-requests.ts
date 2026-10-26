import { isFeedsColour, toFeedsName } from '@anytype-calendar/feeds/domain'
import type { FeedsAddRequest, FeedsEditRequest } from '@shared/ipc'

/** Longer than any address a calendar app publishes; the rest is checked when it is read. */
const MAX_URL_LENGTH = 8192

/* Renderer input is untrusted: these are written to disk, and an address is fetched. Each is
 * null unless `value` is well formed, and nothing but its fields is passed on. */

/** A colour, if given, must be one of the ten. */
export function toFeedsAddRequest(value: unknown): FeedsAddRequest | null {
  const { url, name, colour } = fieldsOf(value)
  if (typeof url !== 'string' || url.length > MAX_URL_LENGTH || typeof name !== 'string') return null
  if (colour === undefined) return { url, name }
  return isFeedsColour(colour) ? { url, name, colour } : null
}

/** A name, if given, must be one; a colour, one of the ten. */
export function toFeedsEditRequest(value: unknown): FeedsEditRequest | null {
  const { id, name, colour } = fieldsOf(value)
  if (!isFeedsId(id)) return null
  const request: FeedsEditRequest = { id }
  if (name !== undefined) {
    const read = toFeedsName(name)
    if (read === null) return null
    request.name = read
  }
  if (colour !== undefined) {
    if (!isFeedsColour(colour)) return null
    request.colour = colour
  }
  return request
}

export function toFeedsOrder(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(isFeedsId) ? [...value] : null
}

export function isFeedsId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-z]{1,64}$/i.test(value)
}

function fieldsOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}
