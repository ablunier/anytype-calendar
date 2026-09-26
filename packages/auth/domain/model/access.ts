/** Which major of Anytype's local API the app is reading through. */
export type AuthApiVersion = 'v1' | 'v2'

/**
 * What the user let the key reach when pairing it in Anytype. Null for a key with no grant of
 * its own — issued before v2, or read through v1, which cannot say — and such a key reaches
 * every space and may write.
 */
export type AuthGrant = {
  /** Every space, including ones created later; `spaceIds` is then empty. */
  allSpaces: boolean
  spaceIds: string[]
  permission: 'read' | 'readwrite'
} | null

export interface AuthAccess {
  apiVersion: AuthApiVersion
  grant: AuthGrant
}

export function sameAuthAccess(a: AuthAccess, b: AuthAccess): boolean {
  if (a.apiVersion !== b.apiVersion) return false
  const [x, y] = [a.grant, b.grant]
  if (x === null || y === null) return x === y
  return (
    x.allSpaces === y.allSpaces &&
    x.permission === y.permission &&
    x.spaceIds.length === y.spaceIds.length &&
    x.spaceIds.every((id, index) => id === y.spaceIds[index])
  )
}
