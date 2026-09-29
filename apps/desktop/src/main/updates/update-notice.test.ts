import { describe, expect, test, vi } from 'vitest'
import { appConfigStore } from '../app-config-file'
import type { AtomicFile } from '../atomic-file'
import { CheckForUpdate, DismissUpdateNotice } from './check-for-update'
import { compareVersions, toLatestRelease, type LatestRelease } from './release-version'
import { UpdateNoticeStore } from './update-notice-store'

const PAGE = 'https://github.com/ablunier/anytype-calendar/releases/tag/'

function fakeFile(): AtomicFile {
  let bytes: Buffer | null = null
  return {
    read: async () => bytes,
    write: async (next) => {
      bytes = Buffer.from(next)
    },
    remove: async () => {
      bytes = null
    }
  }
}

function release(version: string): LatestRelease {
  return { version, url: `${PAGE}v${version}` }
}

function setup(current: string, latest: () => Promise<LatestRelease | null>) {
  const config = appConfigStore(fakeFile())
  const store = new UpdateNoticeStore(current)
  const listener = vi.fn()
  store.subscribe(listener)
  return {
    config,
    store,
    listener,
    check: new CheckForUpdate({ config, store, fetchLatest: latest }),
    dismiss: new DismissUpdateNotice({ config, store })
  }
}

describe('compareVersions', () => {
  test.each([
    ['1.0.1', '1.0.0'],
    ['1.1.0', '1.0.9'],
    ['2.0.0', '1.99.99'],
    ['1.0.0', '1.0.0-beta.1'],
    ['1.0.0-beta.2', '1.0.0-beta.1'],
    ['1.0.0-beta.10', '1.0.0-beta.2'],
    ['1.0.0-rc.1', '1.0.0-beta.9'],
    ['1.0.0-beta.1.1', '1.0.0-beta.1'],
    ['1.0.0-beta', '1.0.0-1'],
    ['v1.0.1', '1.0.0']
  ])('%s is newer than %s', (newer, older) => {
    expect(compareVersions(newer, older)).toBeGreaterThan(0)
    expect(compareVersions(older, newer)).toBeLessThan(0)
  })

  test('ignores build metadata', () => {
    expect(compareVersions('1.0.0+abc', '1.0.0')).toBe(0)
  })

  test('is null for anything that is not semver', () => {
    expect(compareVersions('latest', '1.0.0')).toBeNull()
    expect(compareVersions('1.0', '1.0.0')).toBeNull()
  })
})

describe('toLatestRelease', () => {
  test('reads the tag without its v, and the release page', () => {
    expect(toLatestRelease({ tag_name: 'v1.2.0', html_url: `${PAGE}v1.2.0` })).toEqual(
      release('1.2.0')
    )
  })

  test('refuses a page outside this repository', () => {
    expect(
      toLatestRelease({ tag_name: 'v1.2.0', html_url: 'https://example.com/releases/' })
    ).toBeNull()
  })

  test('refuses a tag that is not a version, and any other shape', () => {
    expect(toLatestRelease({ tag_name: 'nightly', html_url: `${PAGE}nightly` })).toBeNull()
    expect(toLatestRelease({ message: 'Not Found' })).toBeNull()
    expect(toLatestRelease(null)).toBeNull()
  })
})

describe('CheckForUpdate', () => {
  test('holds a newer release', async () => {
    const { store, listener, check } = setup('1.0.0-beta.1', async () => release('1.0.0'))
    await check.execute()
    expect(store.get()).toEqual({
      current: '1.0.0-beta.1',
      available: release('1.0.0'),
      dismissed: false
    })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('holds nothing when the release is the running version, or older', async () => {
    for (const latest of ['1.0.0', '0.9.0']) {
      const { store, listener, check } = setup('1.0.0', async () => release(latest))
      await check.execute()
      expect(store.get().available).toBeNull()
      expect(listener).not.toHaveBeenCalled()
    }
  })

  test('keeps what it last found when a check fails', async () => {
    let latest: LatestRelease | null = release('1.1.0')
    const { store, check } = setup('1.0.0', async () => latest)
    await check.execute()
    latest = null
    await check.execute()
    expect(store.get().available).toEqual(release('1.1.0'))
  })

  test('remembers a closed notice for that version only', async () => {
    let latest = release('1.1.0')
    const { store, check, dismiss } = setup('1.0.0', async () => latest)
    await check.execute()
    await dismiss.execute()
    expect(store.get().dismissed).toBe(true)

    await check.execute()
    expect(store.get().dismissed).toBe(true)

    latest = release('1.2.0')
    await check.execute()
    expect(store.get()).toMatchObject({ available: release('1.2.0'), dismissed: false })
  })
})

describe('DismissUpdateNotice', () => {
  test('writes nothing while there is no notice', async () => {
    const { config, dismiss } = setup('1.0.0', async () => null)
    await dismiss.execute()
    expect(await config.readSection('dismissedUpdate')).toBeNull()
  })
})
