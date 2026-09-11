import { expect, test } from 'vitest'
import { InMemoryCredentialRepository } from './in-memory-credential-repository'

const credential = { apiKey: 'ak_mock_4c19', issuedAt: 42 }

test('holds nothing until a credential is saved', async () => {
  await expect(new InMemoryCredentialRepository().load()).resolves.toBeNull()
})

test('returns what was saved, and nothing once cleared', async () => {
  const repository = new InMemoryCredentialRepository()
  await repository.save(credential)
  await expect(repository.load()).resolves.toEqual(credential)

  await repository.clear()
  await expect(repository.load()).resolves.toBeNull()
})

test('a later save replaces the stored credential', async () => {
  const repository = new InMemoryCredentialRepository()
  await repository.save(credential)
  await repository.save({ apiKey: 'ak_mock_9f00', issuedAt: 43 })
  await expect(repository.load()).resolves.toEqual({ apiKey: 'ak_mock_9f00', issuedAt: 43 })
})

test('the stored credential cannot be changed through an object handed in or out', async () => {
  const repository = new InMemoryCredentialRepository()
  const saved = { ...credential }
  await repository.save(saved)
  saved.apiKey = 'tampered'
  const loaded = await repository.load()
  loaded!.apiKey = 'tampered'

  await expect(repository.load()).resolves.toEqual(credential)
})
