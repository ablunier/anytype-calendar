import type { AuthGrant } from '../../domain'

/**
 * The grant `POST /v2/auth/api_keys` answers with: `{ all_spaces, space_ids, permission }`, or
 * null for a key with no grant. `space_ids` are full ids.
 */
export function grantFromPairing(grant: unknown): AuthGrant {
  if (typeof grant !== 'object' || grant === null) return null
  const allSpaces = field(grant, 'all_spaces') === true
  return {
    allSpaces,
    spaceIds: allSpaces ? [] : stringsIn(field(grant, 'space_ids')),
    permission: permissionOf(field(grant, 'permission'))
  }
}

/**
 * The grant `GET /v2/auth/whoami?ids=full&spaces=true` describes: `scoped` is false for a legacy
 * key, which has no grant; otherwise `restricted` keys list their spaces in `spaces[].id`, and
 * all-spaces grants list every live space there too, which is not their boundary.
 */
export function grantFromWhoami(whoami: unknown): AuthGrant {
  const grant = field(whoami, 'grant')
  if (field(grant, 'scoped') !== true) return null
  const allSpaces = field(grant, 'all_spaces') === true
  const spaces = field(grant, 'spaces')
  return {
    allSpaces,
    spaceIds: allSpaces || !Array.isArray(spaces) ? [] : stringsIn(spaces.map((space) => field(space, 'id'))),
    permission: permissionOf(field(grant, 'permission'))
  }
}

/** Anything but an explicit write grant reads as read-only, so nothing is offered that would be refused. */
function permissionOf(value: unknown): 'read' | 'readwrite' {
  return value === 'readwrite' ? 'readwrite' : 'read'
}

function stringsIn(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item !== '')
    : []
}

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[name]
    : undefined
}
