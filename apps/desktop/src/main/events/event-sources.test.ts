import { expect, test } from 'vitest'
import type { SchemaQueryChoice, SchemaSync, SchemaTypeChoice } from '@anytype-calendar/schema/domain'
import { eventsSourcesFor } from './event-sources'

const TASK: SchemaTypeChoice = {
  spaceId: 'sp_1',
  typeKey: 'task',
  from: 'due_date',
  to: null,
  includesTime: true,
  colourBy: 'priority'
}

const OPEN_TASKS: SchemaQueryChoice = {
  spaceId: 'sp_1',
  queryId: 'q_open',
  viewId: '63194',
  from: 'due_date',
  to: null,
  includesTime: false,
  colourBy: 'priority'
}

const SYNCED: SchemaSync = {
  phase: 'synced',
  last: {
    syncedAt: 0,
    hasNotGrantedSpaces: false,
    spaces: [
      {
        id: 'sp_1',
        name: 'Personal',
        types: [
          {
            key: 'task',
            name: 'Task',
            icon: null,
            dateProperties: [{ key: 'due_date', name: 'Due date' }],
            hasDone: true,
            hasLocation: true,
            selectProperties: [
              { key: 'priority', name: 'Priority', options: [{ name: 'P1', color: 'red' }] },
              { key: 'stage', name: 'Stage', options: [{ name: 'Draft', color: 'grey' }] }
            ]
          }
        ],
        queries: [{ id: 'q_open', name: 'Open tasks', typeKey: 'task', views: [{ id: '63194', name: 'Open' }] }]
      }
    ]
  }
}

test('is empty until a selection is saved', () => {
  expect(eventsSourcesFor({ phase: 'unset' }, SYNCED)).toEqual([])
})

test('keeps the chosen types of chosen spaces only', () => {
  expect(
    eventsSourcesFor(
      {
        phase: 'saved',
        selection: {
          spaceIds: ['sp_1'],
          types: [
            { ...TASK, colourBy: null },
            { ...TASK, spaceId: 'sp_2' },
            { ...TASK, typeKey: 'project', from: 'start_date', to: 'due_date', includesTime: false }
          ],
          queries: []
        }
      },
      { phase: 'idle' }
    )
  ).toEqual([
    { kind: 'type', spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: true },
    {
      kind: 'type',
      spaceId: 'sp_1',
      typeKey: 'project',
      from: 'start_date',
      to: 'due_date',
      includesTime: false
    }
  ])
})

test('reads Done, Location and the chosen colours where the synced type has them', () => {
  expect(
    eventsSourcesFor({ phase: 'saved', selection: { spaceIds: ['sp_1'], types: [TASK], queries: [] } }, SYNCED)
  ).toEqual([
    {
      kind: 'type',
      spaceId: 'sp_1',
      typeKey: 'task',
      from: 'due_date',
      to: null,
      includesTime: true,
      done: 'done',
      location: 'location',
      colourBy: { key: 'priority', options: [{ name: 'P1', color: 'red' }] }
    }
  ])
})

test('colours by nothing when the type no longer has the chosen property', () => {
  const [source] = eventsSourcesFor(
    { phase: 'saved', selection: { spaceIds: ['sp_1'], types: [{ ...TASK, colourBy: 'gone' }], queries: [] } },
    SYNCED
  )
  expect(source).not.toHaveProperty('colourBy')
})

test("puts queries after types, and reads a query's details through the type it runs over", () => {
  const sources = eventsSourcesFor(
    {
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1'],
        types: [TASK],
        queries: [OPEN_TASKS, { ...OPEN_TASKS, spaceId: 'sp_2' }]
      }
    },
    SYNCED
  )
  expect(sources.map(({ kind }) => kind)).toEqual(['type', 'query'])
  expect(sources[1]).toEqual({
    kind: 'query',
    spaceId: 'sp_1',
    queryId: 'q_open',
    viewId: '63194',
    from: 'due_date',
    to: null,
    includesTime: false,
    done: 'done',
    location: 'location',
    colourBy: { key: 'priority', options: [{ name: 'P1', color: 'red' }] }
  })
})

test('reads a query by its dates alone before a sync has seen it', () => {
  expect(
    eventsSourcesFor(
      { phase: 'saved', selection: { spaceIds: ['sp_1'], types: [], queries: [OPEN_TASKS] } },
      { phase: 'idle' }
    )
  ).toEqual([
    {
      kind: 'query',
      spaceId: 'sp_1',
      queryId: 'q_open',
      viewId: '63194',
      from: 'due_date',
      to: null,
      includesTime: false
    }
  ])
})
