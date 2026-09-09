import { expect, test } from 'vitest'

// Infrastructure smoke test: proves the vitest project is wired and the barrel resolves.
// Delete once this package has real tests.
test('domain barrel is importable', async () => {
  await expect(import('./index')).resolves.toBeDefined()
})
