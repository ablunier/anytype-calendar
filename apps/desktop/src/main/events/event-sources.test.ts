import { expect, test } from 'vitest'
import type { SchemaQueryChoice, SchemaSync, SchemaTypeChoice } from '@anytype-calendar/schema/domain'
import { eventsSourcesFor } from './event-sources'

const TASK: SchemaTypeChoice = {
  spaceId: 'sp_1',
  typeKey: 'task',
  from: 'due_date',
  to: null,
  includesTime: true,
  colourBy: 'priority',
  panel: [],
  done: 'done',
  location: 'location'
}

const OPEN_TASKS: SchemaQueryChoice = {
  spaceId: 'sp_1',
  queryId: 'q_open',
  viewId: '63194',
  from: 'due_date',
  to: null,
  includesTime: false,
  colourBy: 'priority',
  panel: [],
  done: 'done',
  location: 'location'
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
            checkboxProperties: [
              { key: 'done', name: 'Done' },
              { key: 'finished', name: 'Finished' }
            ],
            textProperties: [
              { key: 'location', name: 'Location' },
              { key: 'venue', name: 'Venue' }
            ],
            panelProperties: [
              { key: 'venue', name: 'Venue', format: 'text' },
              { key: 'stage', name: 'Stage', format: 'select', options: [{ name: 'Draft', color: 'grey' }] },
              { key: 'project', name: 'Project', format: 'objects' }
            ],
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

test('reads the Done and Location the user picked, where the synced type has them', () => {
  const [picked, gone, none] = eventsSourcesFor(
    {
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1'],
        types: [{ ...TASK, done: 'finished', location: 'venue' }],
        queries: [
          { ...OPEN_TASKS, done: 'gone', location: 'gone' },
          { ...OPEN_TASKS, queryId: 'q_open_2', done: null, location: null }
        ]
      }
    },
    {
      ...SYNCED,
      last: {
        ...SYNCED.last,
        spaces: SYNCED.last.spaces.map((space) => ({
          ...space,
          queries: [...space.queries, { id: 'q_open_2', name: 'Also open', typeKey: 'task', views: [] }]
        }))
      }
    } as SchemaSync
  )
  expect(picked).toMatchObject({ done: 'finished', location: 'venue' })
  expect(gone).not.toHaveProperty('done')
  expect(gone).not.toHaveProperty('location')
  expect(none).not.toHaveProperty('done')
  expect(none).not.toHaveProperty('location')
})

test("reads the panel's properties in the chosen order, leaving out ones the synced type lacks", () => {
  const [source] = eventsSourcesFor(
    {
      phase: 'saved',
      selection: { spaceIds: ['sp_1'], types: [{ ...TASK, panel: ['project', 'gone', 'stage', 'venue'] }], queries: [] }
    },
    SYNCED
  )
  expect(source?.panel).toEqual([
    { key: 'project', format: 'objects' },
    { key: 'stage', format: 'select', options: [{ name: 'Draft', color: 'grey' }] },
    { key: 'venue', format: 'text' }
  ])
})

test('shows nothing more for a panel with nothing the synced type has', () => {
  const [source] = eventsSourcesFor(
    { phase: 'saved', selection: { spaceIds: ['sp_1'], types: [{ ...TASK, panel: ['gone'] }], queries: [] } },
    SYNCED
  )
  expect(source).not.toHaveProperty('panel')
})
