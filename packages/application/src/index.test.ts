import { expect, test } from 'vitest'

// Infrastructure smoke test: proves the vitest project is wired and that this package can
// resolve the domain package. Delete once this package has real tests.
test('application barrel resolves alongside domain', async () => {
  await expect(import('./index')).resolves.toBeDefined()
  await expect(import('@anytype-calendar/domain')).resolves.toBeDefined()
})
