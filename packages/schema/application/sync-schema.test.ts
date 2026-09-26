import { describe, expect, test, vi } from 'vitest'
import type {
  SchemaGateway,
  SchemaGatewayResult,
  SchemaProperty,
  SchemaSpaceList,
  SchemaSpaceRef,
  SchemaSync,
  SchemaTypeRef
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

const CREATED: SchemaProperty = { key: 'created_date', name: 'Creation date', format: 'date' }
const DUE: SchemaProperty = { key: 'due_date', name: 'Due date', format: 'date' }
const START: SchemaProperty = { key: 'start_date', name: 'Start date', format: 'date' }
const FINISH: SchemaProperty = { key: 'finish_date', name: 'Finish date', format: 'date' }
const TAG: SchemaProperty = { key: 'tag', name: 'Tag', format: 'multi_select' }

const TYPES: Record<string, SchemaTypeRef[]> = {
  sp_personal: [
    { key: 'task', name: 'Task', icon: { name: 'checkbox', color: 'lime' }, properties: [TAG, DUE, CREATED] },
    { key: 'page', name: 'Page', icon: null, properties: [TAG, CREATED] },
    { key: 'project', name: 'Project', icon: null, properties: [START, FINISH, CREATED] }
  ],
  sp_empty: [{ key: 'page', name: 'Page', icon: null, properties: [CREATED] }]
}

const ok = <T>(value: T): SchemaGatewayResult<T> => ({ ok: true, value })
const listed = (spaces: SchemaSpaceRef[], hasNotGrantedSpaces = false): SchemaSpaceList => ({
  spaces,
  hasNotGrantedSpaces
})
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
    listSpaces: vi.fn<SchemaGateway['listSpaces']>(async () => ok(listed(SPACES))),
    listTypes: vi.fn<SchemaGateway['listTypes']>(async (_key, spaceId) => ok(TYPES[spaceId] ?? []))
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

test('reads every space with its dated types', async () => {
  const { gateway, store, syncSchema } = setup()

  await syncSchema.execute()

  expect(store.get()).toEqual({
    phase: 'synced',
    last: {
      syncedAt: NOW,
      hasNotGrantedSpaces: false,
      spaces: [
        {
          id: 'sp_personal',
          name: 'Personal',
          types: [
            {
              key: 'task',
              name: 'Task',
              icon: { name: 'checkbox', color: 'lime' },
              dateProperties: [{ key: 'due_date', name: 'Due date' }]
            },
            {
              key: 'project',
              name: 'Project',
              icon: null,
              dateProperties: [
                { key: 'start_date', name: 'Start date' },
                { key: 'finish_date', name: 'Finish date' }
              ]
            }
          ]
        },
        { id: 'sp_empty', name: 'Empty', types: [] }
      ]
    }
  })
  expect(gateway.listSpaces).toHaveBeenCalledWith(API_KEY)
  expect(gateway.listTypes).toHaveBeenCalledWith(API_KEY, 'sp_personal')
})

test('says when the key was not granted every space', async () => {
  const { gateway, store, syncSchema } = setup()
  gateway.listSpaces.mockResolvedValueOnce(ok(listed(SPACES, true)))
  await syncSchema.execute()
  expect(store.get()).toMatchObject({ phase: 'synced', last: { hasNotGrantedSpaces: true } })
})

test('leaves out a type without user date properties', async () => {
  const { syncSchema, store } = setup()
  await syncSchema.execute()
  const { last } = store.get() as Extract<SchemaSync, { phase: 'synced' }>
  expect(last.spaces[0]?.types.map((type) => type.key)).not.toContain('page')
})

test('is syncing while Anytype is being read', async () => {
  const { gateway, store, syncSchema } = setup()
  const spaces = deferred<SchemaGatewayResult<SchemaSpaceList>>()
  gateway.listSpaces.mockReturnValueOnce(spaces.promise)

  const running = syncSchema.execute()
  expect(store.get()).toEqual({ phase: 'syncing' })

  spaces.resolve(ok(listed([])))
  await running
  expect(store.get()).toEqual({
    phase: 'synced',
    last: { spaces: [], hasNotGrantedSpaces: false, syncedAt: NOW }
  })
})

test('fails as unauthorized without a stored key, asking Anytype nothing', async () => {
  const { gateway, store, syncSchema } = setup(null)
  await syncSchema.execute()
  expect(store.get()).toEqual({ phase: 'failed', failure: 'unauthorized', at: NOW })
  expect(gateway.listSpaces).not.toHaveBeenCalled()
})

test.each(['listSpaces', 'listTypes'] as const)(
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
  gateway.listTypes.mockRejectedValue(new TypeError('fetch failed'))
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
    const spaces = deferred<SchemaGatewayResult<SchemaSpaceList>>()
    gateway.listSpaces.mockReturnValueOnce(spaces.promise)

    const running = syncSchema.execute()
    resetSchemaSync.execute()
    spaces.resolve(ok(listed(SPACES)))
    await running

    expect(store.get()).toEqual({ phase: 'idle' })
  })

  test('drops a failure that lands after a reset', async () => {
    const { gateway, store, syncSchema } = setup()
    const resetSchemaSync = new ResetSchemaSync(store)
    const spaces = deferred<SchemaGatewayResult<SchemaSpaceList>>()
    gateway.listSpaces.mockReturnValueOnce(spaces.promise)

    const running = syncSchema.execute()
    resetSchemaSync.execute()
    spaces.resolve(unauthorized)
    await running

    expect(store.get()).toEqual({ phase: 'idle' })
  })
})
