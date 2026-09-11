import { expect, test } from 'vitest'
import {
  EncryptedFileCredentialRepository,
  type CredentialCipher,
  type CredentialFile
} from './encrypted-file-credential-repository'

const credential = { apiKey: 'ak_secret_4c19', issuedAt: 42 }

/** Reversible, and far enough from plaintext that the key never shows in the bytes. */
const cipher: CredentialCipher = {
  encrypt: (plain) => Uint8Array.from(plain, (char) => char.charCodeAt(0) ^ 0x5a),
  decrypt: (sealed) => String.fromCharCode(...sealed.map((byte) => byte ^ 0x5a))
}

function setup(initial: Uint8Array | null = null) {
  let bytes = initial
  const file: CredentialFile = {
    read: async () => bytes,
    write: async (next) => {
      bytes = next
    },
    remove: async () => {
      bytes = null
    }
  }
  return {
    repository: new EncryptedFileCredentialRepository({ cipher, file }),
    stored: () => bytes
  }
}

test('holds nothing while there is no file', async () => {
  await expect(setup().repository.load()).resolves.toBeNull()
})

test('returns what was saved, encrypted at rest', async () => {
  const { repository, stored } = setup()
  await repository.save(credential)

  await expect(repository.load()).resolves.toEqual(credential)
  expect(new TextDecoder().decode(stored()!)).not.toContain(credential.apiKey)
})

test('a later save replaces the stored credential', async () => {
  const { repository } = setup()
  await repository.save(credential)
  await repository.save({ apiKey: 'ak_secret_9f00', issuedAt: 43 })

  await expect(repository.load()).resolves.toEqual({ apiKey: 'ak_secret_9f00', issuedAt: 43 })
})

test('nothing is left once cleared', async () => {
  const { repository, stored } = setup()
  await repository.save(credential)
  await repository.clear()

  expect(stored()).toBeNull()
  await expect(repository.load()).resolves.toBeNull()
})

test('a file that cannot be decrypted loads as no credential', async () => {
  const repository = new EncryptedFileCredentialRepository({
    cipher: {
      ...cipher,
      decrypt: () => {
        throw new Error('Error while decrypting the ciphertext provided to safeStorage.decryptString.')
      }
    },
    file: { read: async () => new Uint8Array([1, 2, 3]), write: async () => {}, remove: async () => {} }
  })

  await expect(repository.load()).resolves.toBeNull()
})

test('a file that cannot be read loads as no credential', async () => {
  const repository = new EncryptedFileCredentialRepository({
    cipher,
    file: {
      read: async () => {
        throw new Error('EACCES')
      },
      write: async () => {},
      remove: async () => {}
    }
  })

  await expect(repository.load()).resolves.toBeNull()
})

test.each([
  ['not JSON', 'ak_secret_4c19'],
  ['not an object', '"ak_secret_4c19"'],
  ['missing the key', '{"issuedAt":42}'],
  ['an empty key', '{"apiKey":"","issuedAt":42}'],
  ['a non-numeric issue time', '{"apiKey":"ak_secret_4c19","issuedAt":"42"}']
])('a file holding %s loads as no credential', async (_label, plain) => {
  await expect(setup(cipher.encrypt(plain)).repository.load()).resolves.toBeNull()
})
