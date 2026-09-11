import { describe, expect, test, vi } from 'vitest'
import type {
  SchemaGateway,
  SchemaGatewayResult,
  SchemaProperty,
  SchemaSpaceRef,
  SchemaSync
} from '../domain'
import { ResetSchemaSync } from './reset-schema-sync'
import { SchemaSyncStore } from './schema-sync-store'
import { SyncSchema } from './sync-schema'

const API_KEY = 'ak_secret'
const NOW = 7_000

const SPACES: SchemaSpaceRef[] = [
  { id: 'sp_personal', name: 'Personal' },
  { id: 'sp_empty', name: 'Empty' }
]

const PROPERTIES: Record<string, SchemaProperty[]> = {
  sp_personal: [
    { key: 'created_date', name: 'Creation date', format: 'date' },
    { key: 'due_date', name: 'Due date', format: 'date' },
    { key: 'start_date', name: 'Start date', format: 'date' }
  ],
  sp_empty: [{ key: 'created_date', name: 'Creation date', format: 'date' }]
}

const ok = <T>(value: T): SchemaGatewayResult<T> => ({ ok: true, value })
const unauthorized = { ok: false, failure: 'unauthorized' } as const

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function setup(apiKey: string | null = API_KEY) {
  const gateway = {
    listSpaces: vi.fn<SchemaGateway['listSpaces']>(async () => ok(SPACES)),
    listProperties: vi.fn<SchemaGateway['listProperties']>(async (_key, spaceId) =>
      ok(PROPERTIES[spaceId] ?? [])
    ),
    countObjectsWithAnyValue: vi.fn<SchemaGateway['countObjectsWithAnyValue']>(async () => ok(42))
  }
  const store = new SchemaSyncStore()
  const syncSchema = new SyncSchema({
    gateway,
    apiKeys: { current: async () => apiKey },
    store,
    now: () => NOW
  })
  return { gateway, store, syncSchema }
}

test('reads every space and counts its dated objects', async () => {
  const { gateway, store, syncSchema } = setup()

  await syncSchema.execute()

  expect(store.get()).toEqual({
    phase: 'synced',
    last: {
      syncedAt: NOW,
      spaces: [
        { id: 'sp_personal', name: 'Personal', datedObjectCount: 42 },
        { id: 'sp_empty', name: 'Empty', datedObjectCount: 0 }
      ]
    }
  })
  expect(gateway.listSpaces).toHaveBeenCalledWith(API_KEY)
  expect(gateway.countObjectsWithAnyValue).toHaveBeenCalledWith(API_KEY, 'sp_personal', [
    'due_date',
    'start_date'
  ])
})

test('asks for no count in a space without user date properties', async () => {
  const { gateway, syncSchema } = setup()
  await syncSchema.execute()
  expect(gateway.countObjectsWithAnyValue).not.toHaveBeenCalledWith(
    expect.anything(),
    'sp_empty',
    expect.anything()
  )
})

test('is syncing while Anytype is being read', async () => {
  const { gateway, store, syncSchema } = setup()
  const spaces = deferred<SchemaGatewayResult<SchemaSpaceRef[]>>()
  gateway.listSpaces.mockReturnValueOnce(spaces.promise)

  const running = syncSchema.execute()
  expect(store.get()).toEqual({ phase: 'syncing' })

  spaces.resolve(ok([]))
  await running
  expect(store.get()).toEqual({ phase: 'synced', last: { spaces: [], syncedAt: NOW } })
})

test('fails as unauthorized without a stored key, asking Anytype nothing', async () => {
  const { gateway, store, syncSchema } = setup(null)
  await syncSchema.execute()
  expect(store.get()).toEqual({ phase: 'failed', failure: 'unauthorized', at: NOW })
  expect(gateway.listSpaces).not.toHaveBeenCalled()
})

test.each(['listSpaces', 'listProperties', 'countObjectsWithAnyValue'] as const)(
  'fails as unauthorized when %s is refused',
  async (method) => {
    const { gateway, store, syncSchema } = setup()
    gateway[method].mockResolvedValue(unauthorized)
    await syncSchema.execute()
    expect(store.get()).toMatchObject({ phase: 'failed', failure: 'unauthorized' })
  }
)

test('fails as unreachable when a request rejects', async () => {
  const { gateway, store, syncSchema } = setup()
  gateway.listProperties.mockRejectedValue(new TypeError('fetch failed'))
  await syncSchema.execute()
  expect(store.get()).toEqual({ phase: 'failed', failure: 'unreachable', at: NOW })
})

test('keeps the last result through a failed resync', async () => {
  const { gateway, store, syncSchema } = setup()
  await syncSchema.execute()
  const { last } = store.get() as Extract<SchemaSync, { phase: 'synced' }>

  gateway.listSpaces.mockRejectedValueOnce(new TypeError('fetch failed'))
  await syncSchema.execute()

  expect(store.get()).toEqual({ phase: 'failed', failure: 'unreachable', at: NOW, last })
})

test('a second sync while one runs does not read Anytype again', async () => {
  const { gateway, syncSchema } = setup()
  await Promise.all([syncSchema.execute(), syncSchema.execute()])
  expect(gateway.listSpaces).toHaveBeenCalledTimes(1)
})

describe('racing a reset', () => {
  test('drops a result that lands after a reset', async () => {
    const { gateway, store, syncSchema } = setup()
    const resetSchemaSync = new ResetSchemaSync(store)
    const spaces = deferred<SchemaGatewayResult<SchemaSpaceRef[]>>()
    gateway.listSpaces.mockReturnValueOnce(spaces.promise)

    const running = syncSchema.execute()
    resetSchemaSync.execute()
    spaces.resolve(ok(SPACES))
    await running

    expect(store.get()).toEqual({ phase: 'idle' })
  })

  test('drops a failure that lands after a reset', async () => {
    const { gateway, store, syncSchema } = setup()
    const resetSchemaSync = new ResetSchemaSync(store)
    const spaces = deferred<SchemaGatewayResult<SchemaSpaceRef[]>>()
    gateway.listSpaces.mockReturnValueOnce(spaces.promise)

    const running = syncSchema.execute()
    resetSchemaSync.execute()
    spaces.resolve(unauthorized)
    await running

    expect(store.get()).toEqual({ phase: 'idle' })
  })
})
