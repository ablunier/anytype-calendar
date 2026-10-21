import { expect, test } from 'vitest'
import type { FeedsSubscription } from '../../domain'
import {
  EncryptedFileFeedsSubscriptionRepository,
  type FeedsUrlCipher
} from './encrypted-file-feeds-subscription-repository'

/** Reversible, and far enough from plaintext that an address never shows in the file. */
const cipher: FeedsUrlCipher = {
  seal: (plain) => [...plain].map((char) => (char.charCodeAt(0) ^ 0x5a).toString(16).padStart(2, '0')).join(''),
  open: (sealed) => {
    if (!/^([0-9a-f]{2})+$/.test(sealed)) throw new Error('cannot open')
    return (sealed.match(/../g) ?? []).map((hex) => String.fromCharCode(parseInt(hex, 16) ^ 0x5a)).join('')
  }
}

const holidays: FeedsSubscription = {
  id: 'a1b2',
  name: 'Holidays',
  url: 'https://calendar.google.com/calendar/ical/private-secret/basic.ics',
  colour: 'teal'
}
const family: FeedsSubscription = { id: 'c3d4', name: 'Family', url: 'https://example.com/family.ics', colour: 'pink' }

function setup(initial: string | null = null) {
  let text = initial
  return {
    repository: new EncryptedFileFeedsSubscriptionRepository({
      cipher,
      file: {
        read: async () => text,
        write: async (next) => {
          text = next
        }
      }
    }),
    stored: () => text
  }
}

test('holds nothing while there is no file', async () => {
  await expect(setup().repository.load()).resolves.toEqual([])
})

test('returns what was saved, in order, with each address sealed at rest', async () => {
  const { repository, stored } = setup()
  await repository.save([holidays, family])
  await expect(repository.load()).resolves.toEqual([holidays, family])
  expect(stored()).not.toContain('private-secret')
  expect(stored()).not.toContain('example.com')
  expect(stored()).toContain('Holidays')
})

test('leaves out an entry whose address cannot be opened, keeping the others', async () => {
  const { repository, stored } = setup()
  await repository.save([holidays, family])
  const broken = JSON.parse(stored() ?? '') as { subscriptions: { url: string }[] }
  broken.subscriptions[0]!.url = 'not sealed'
  await expect(setup(JSON.stringify(broken)).repository.load()).resolves.toEqual([family])
})

test('leaves out malformed and repeated entries, and falls back to blue for an unknown colour', async () => {
  const entry = (fields: Record<string, unknown>) => ({ id: 'e1', name: 'X', colour: 'red', url: cipher.seal('https://example.com/x.ics'), ...fields })
  const { repository } = setup(
    JSON.stringify({
      version: 1,
      subscriptions: [
        entry({ colour: 'chartreuse' }),
        entry({ name: 'Again' }),
        entry({ id: '../escape' }),
        entry({ id: 'e2', name: '' }),
        entry({ id: 'e3', url: cipher.seal('ftp://example.com/x.ics') }),
        'nonsense'
      ]
    })
  )
  await expect(repository.load()).resolves.toEqual([
    { id: 'e1', name: 'X', url: 'https://example.com/x.ics', colour: 'blue' }
  ])
})

test.each([
  ['not JSON', 'subscriptions'],
  ['not an object', '"a"'],
  ['no list', '{"version":1}']
])('a file holding %s loads as no subscriptions', async (_, text) => {
  await expect(setup(text).repository.load()).resolves.toEqual([])
})

test('a file that cannot be read loads as no subscriptions', async () => {
  const repository = new EncryptedFileFeedsSubscriptionRepository({
    cipher,
    file: {
      read: async () => {
        throw new Error('EACCES')
      },
      write: async () => {}
    }
  })
  await expect(repository.load()).resolves.toEqual([])
})
