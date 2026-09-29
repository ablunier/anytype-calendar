export interface LatestRelease {
  /** Without the tag's leading `v`. */
  version: string
  url: string
}

/** Only this repository's own release pages are ever handed to `shell.openExternal`. */
const RELEASE_PAGE_PREFIX = 'https://github.com/ablunier/anytype-calendar/releases/'

interface Version {
  core: [number, number, number]
  prerelease: string[]
}

function parseVersion(text: string): Version | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(text)
  if (!match) return null
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split('.') : []
  }
}

/** Semver precedence, so `1.0.0-beta.2` < `1.0.0-beta.10` < `1.0.0`. Null when either is not semver. */
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) return null
  for (let i = 0; i < 3; i++) {
    if (left.core[i] !== right.core[i]) return left.core[i] - right.core[i]
  }
  // A release outranks any of its prereleases.
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return right.prerelease.length - left.prerelease.length
  }
  const length = Math.min(left.prerelease.length, right.prerelease.length)
  for (let i = 0; i < length; i++) {
    const order = compareIdentifiers(left.prerelease[i], right.prerelease[i])
    if (order !== 0) return order
  }
  return left.prerelease.length - right.prerelease.length
}

function compareIdentifiers(a: string, b: string): number {
  const aNumeric = /^\d+$/.test(a)
  const bNumeric = /^\d+$/.test(b)
  if (aNumeric && bNumeric) return Number(a) - Number(b)
  if (aNumeric !== bNumeric) return aNumeric ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

/** Reads GitHub's `GET /repos/{owner}/{repo}/releases/latest` body. */
export function toLatestRelease(body: unknown): LatestRelease | null {
  if (typeof body !== 'object' || body === null) return null
  const { tag_name: tag, html_url: url } = body as Record<string, unknown>
  if (typeof tag !== 'string' || typeof url !== 'string') return null
  if (!url.startsWith(RELEASE_PAGE_PREFIX) || !parseVersion(tag)) return null
  return { version: tag.replace(/^v/, ''), url }
}
