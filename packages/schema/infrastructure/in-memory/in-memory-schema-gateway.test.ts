import { expect, test } from 'vitest'
import { InMemorySchemaGateway, type InMemorySchemaSpace } from './in-memory-schema-gateway'

const SPACE: InMemorySchemaSpace = {
  id: 'sp_1',
  name: 'Personal',
  types: [
    {
      key: 'task',
      name: 'Task',
      icon: { name: 'checkbox', color: 'lime' },
      properties: [{ key: 'due_date', name: 'Due date', format: 'date' }],
      datedObjectCount: 9
    }
  ]
}

function setup() {
  const sleeps: number[] = []
  const gateway = new InMemorySchemaGateway({
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    spaces: [SPACE],
    requestLatencyMs: 50
  })
  return { gateway, sleeps }
}

test('lists the seeded spaces after the simulated latency', async () => {
  const { gateway, sleeps } = setup()
  await expect(gateway.listSpaces()).resolves.toEqual({
    ok: true,
    value: [{ id: 'sp_1', name: 'Personal' }]
  })
  expect(sleeps).toEqual([50])
})

test("answers with a space's types and a type's dated count", async () => {
  const { gateway } = setup()
  await expect(gateway.listTypes('ak_any', 'sp_1')).resolves.toEqual({
    ok: true,
    value: [
      {
        key: 'task',
        name: 'Task',
        icon: { name: 'checkbox', color: 'lime' },
        properties: [{ key: 'due_date', name: 'Due date', format: 'date' }]
      }
    ]
  })
  await expect(gateway.countObjectsWithAnyValue('ak_any', 'sp_1', 'task')).resolves.toEqual({
    ok: true,
    value: 9
  })
})

test('rejects for a space it does not know', async () => {
  const { gateway } = setup()
  await expect(gateway.listTypes('ak_any', 'sp_missing')).rejects.toThrow('sp_missing')
})

test('ships the design sample account by default', async () => {
  const gateway = new InMemorySchemaGateway({ sleep: async () => {} })
  const result = await gateway.listSpaces()
  expect(result.ok && result.value.map(({ name }) => name)).toEqual([
    'Personal',
    'Studio',
    'Reading',
    'Archive 2024'
  ])
})
