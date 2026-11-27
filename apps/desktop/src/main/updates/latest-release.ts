import { type LatestRelease, toLatestRelease } from './release-version'

export const RELEASE_REPO = 'ablunier/anytype-calendar'
const CHECK_TIMEOUT_MS = 15_000

/**
 * GitHub's latest release, which is never a draft or a prerelease. Unauthenticated, this is
 * allowed 60 requests an hour per address, far more than a check every few hours needs.
 */
export async function fetchLatestRelease(): Promise<LatestRelease | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'anytype-calendar' },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    })
    if (!response.ok) return null
    return toLatestRelease(await response.json())
  } catch {
    return null
  }
}
