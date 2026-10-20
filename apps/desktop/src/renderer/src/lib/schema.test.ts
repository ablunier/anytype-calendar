import { describe, expect, test } from 'vitest'
import type { SchemaQueryChoice, SchemaSpace, SchemaType } from '@anytype-calendar/schema/domain'
import type { SchemaSelectionSnapshot, SchemaSnapshot } from '@shared/ipc'
import type { ObjectType, TypePicks } from '@renderer/types'
import {
  anytypeTypeKeyOf,
  creatableTypesFor,
  elapsedSince,
  hasNotGrantedSpaces,
  isOnboarded,
  objectTypeKey,
  picksFor,
  querySourceKey,
  schemaSelectionFor,
  spacesFor,
  syncViewFor,
  tracksAnyType,
  typesFor
} from './schema'

const DUE = { key: 'due_date', name: 'Due date' }
const START = { key: 'start_date', name: 'Start date' }

const TASK_TYPE: SchemaType = {
  key: 'task',
  name: 'Task',
  icon: { name: 'checkbox', color: 'lime' },
  dateProperties: [DUE, START],
  checkboxProperties: [{ key: 'done', name: 'Done' }],
  textProperties: [{ key: 'venue', name: 'Venue' }],
  panelProperties: [
    { key: 'venue', name: 'Venue', format: 'text' },
    { key: 'project', name: 'Project', format: 'objects' }
  ],
  selectProperties: [{ key: 'priority', name: 'Priority', options: [{ name: 'P1', color: 'red' }] }]
}

const UNKNOWN_ICON_TYPE: SchemaType = {
  key: 'note',
  name: 'Note',
  icon: { name: 'mystery-icon', color: 'mystery-color' },
  dateProperties: [DUE],
  checkboxProperties: [],
  textProperties: [],
  panelProperties: [],
  selectProperties: []
}

const NO_ICON_TYPE: SchemaType = {
  key: 'idea',
  name: 'Idea',
  icon: null,
  dateProperties: [DUE],
  checkboxProperties: [],
  textProperties: [],
  panelProperties: [],
  selectProperties: []
}

/** How a task is ticked done, placed and detailed until the user picks otherwise. */
const TASK_DETAILS = { panel: [], done: 'done', location: null }

const SPACE: SchemaSpace = {
  id: 'sp_1',
  name: 'Personal',
  types: [TASK_TYPE, UNKNOWN_ICON_TYPE, NO_ICON_TYPE],
  queries: []
}

const SYNCED_AT = 100_000
const SYNCED: SchemaSnapshot = {
  phase: 'synced',
  last: { spaces: [SPACE], hasNotGrantedSpaces: false, syncedAt: SYNCED_AT }
}

describe('hasNotGrantedSpaces', () => {
  test('is false until a sync has succeeded', () => {
    expect(hasNotGrantedSpaces({ phase: 'idle' })).toBe(false)
    expect(hasNotGrantedSpaces({ phase: 'syncing' })).toBe(false)
  })

  test('follows the last successful sync, through a failed one', () => {
    const last = { spaces: [SPACE], hasNotGrantedSpaces: true, syncedAt: SYNCED_AT }
    expect(hasNotGrantedSpaces({ phase: 'synced', last })).toBe(true)
    expect(hasNotGrantedSpaces({ phase: 'failed', failure: 'unreachable', at: 0, last })).toBe(true)
    expect(hasNotGrantedSpaces(SYNCED)).toBe(false)
  })
})

describe('tracksAnyType', () => {
  const task = { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy: null, ...TASK_DETAILS }

  test('is false until a selection is saved', () => {
    expect(tracksAnyType({ phase: 'unset' })).toBe(false)
  })

  test('is true for a chosen type in a chosen space', () => {
    expect(tracksAnyType({ phase: 'saved', selection: { spaceIds: ['sp_1'], types: [task], queries: [] } })).toBe(true)
  })

  test('is false when the only chosen type sits in a space no longer chosen', () => {
    expect(tracksAnyType({ phase: 'saved', selection: { spaceIds: ['sp_2'], types: [task], queries: [] } })).toBe(false)
    expect(tracksAnyType({ phase: 'saved', selection: { spaceIds: [], types: [], queries: [] } })).toBe(false)
  })
})

describe('objectTypeKey', () => {
  test('is the key typesFor gives the type', () => {
    expect(objectTypeKey('sp_1', 'task')).toBe(typesFor(SYNCED)[0]?.key)
  })

  test("is undone by anytypeTypeKeyOf, even for a space id with dots and a key that is Anytype's own", () => {
    const [task] = typesFor(SYNCED)
    expect(task && anytypeTypeKeyOf(task)).toBe('task')
    const minted = { space: 'bafy.a:b', key: objectTypeKey('bafy.a:b', '6a67272659c08021576f3127') }
    expect(anytypeTypeKeyOf(minted as ObjectType)).toBe('6a67272659c08021576f3127')
  })
})

describe('creatableTypesFor', () => {
  const query: SchemaQueryChoice['queryId'] = 'q_1'
  const space: SchemaSpace = {
    ...SPACE,
    queries: [{ id: query, name: 'Open tasks', typeKey: 'task', views: [{ id: 'v_1', name: 'All' }] }]
  }
  const types = typesFor({ phase: 'synced', last: { spaces: [space], hasNotGrantedSpaces: false, syncedAt: 0 } })

  test('offers the chosen types of chosen spaces, never a query', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: [objectTypeKey('sp_1', 'task'), querySourceKey('sp_1', query)],
      dates: {}
    }
    expect(creatableTypesFor(types, picks).map(({ key }) => key)).toEqual([objectTypeKey('sp_1', 'task')])
    expect(creatableTypesFor(types, { ...picks, spaceKeys: [] })).toEqual([])
  })
})

describe('elapsedSince', () => {
  test('rounds down to the largest unit', () => {
    expect(elapsedSince(0, 59_000)).toEqual({ key: 'justNow' })
    expect(elapsedSince(0, 3 * 60_000)).toEqual({ key: 'minutesAgo', count: 3 })
    expect(elapsedSince(0, 5 * 3_600_000)).toEqual({ key: 'hoursAgo', count: 5 })
    expect(elapsedSince(0, 2 * 86_400_000)).toEqual({ key: 'daysAgo', count: 2 })
  })
})

describe('spacesFor', () => {
  test('is empty before any successful sync', () => {
    expect(spacesFor({ phase: 'idle' })).toEqual([])
  })

  test('maps each synced space', () => {
    expect(spacesFor(SYNCED)).toEqual([{ key: 'sp_1', name: 'Personal' }])
  })

  test("carries a space's image", () => {
    const withIcon: SchemaSnapshot = {
      phase: 'synced',
      last: { ...SYNCED.last, spaces: [{ ...SPACE, icon: 'data:image/png;base64,AA==' }] }
    }
    expect(spacesFor(withIcon)).toEqual([{ key: 'sp_1', name: 'Personal', icon: 'data:image/png;base64,AA==' }])
  })

  test('keeps the last result while a new sync is failing', () => {
    const failed: SchemaSnapshot = { phase: 'failed', failure: 'unreachable', at: 200_000, last: SYNCED.last }
    expect(spacesFor(failed)).toEqual([{ key: 'sp_1', name: 'Personal' }])
  })
})

describe('typesFor', () => {
  test('is empty before any successful sync', () => {
    expect(typesFor({ phase: 'idle' })).toEqual([])
  })

  test('maps a type to its space-scoped key, hue and icon', () => {
    const [task] = typesFor(SYNCED)
    expect(task).toEqual({
      key: 'sp_1:task',
      space: 'sp_1',
      label: 'Task',
      category: 'sage',
      icon: 'check',
      props: [
        { key: 'due_date', label: 'Due date' },
        { key: 'start_date', label: 'Start date' }
      ],
      selects: [{ key: 'priority', label: 'Priority' }],
      checkboxes: [{ key: 'done', label: 'Done' }],
      texts: [{ key: 'venue', label: 'Venue' }],
      panelProps: [
        { key: 'venue', label: 'Venue', format: 'text' },
        { key: 'project', label: 'Project', format: 'objects' }
      ],
      from: 'due_date',
      to: null,
      includesTime: false,
      colourBy: null,
      ...TASK_DETAILS
    })
  })

  test("starts a type with no Done of Anytype's own on none, and one with Location on it", () => {
    const [, note] = typesFor({
      phase: 'synced',
      last: {
        hasNotGrantedSpaces: false,
        syncedAt: SYNCED_AT,
        spaces: [
          {
            ...SPACE,
            types: [
              TASK_TYPE,
              { ...UNKNOWN_ICON_TYPE, textProperties: [{ key: 'location', name: 'Location' }] }
            ]
          }
        ]
      }
    })
    expect(note).toMatchObject({ done: null, location: 'location', panel: [] })
  })

  test('falls back to graphite/calendar for an icon Anytype uses that has no vendored match', () => {
    const [, note] = typesFor(SYNCED)
    expect(note).toMatchObject({ category: 'graphite', icon: 'calendar' })
  })

  test('falls back to graphite/calendar for a type with no icon at all', () => {
    const [, , idea] = typesFor(SYNCED)
    expect(idea).toMatchObject({ category: 'graphite', icon: 'calendar' })
  })

  test('defaults every type to a single day on its first date property', () => {
    const types = typesFor(SYNCED)
    expect(types.every((type) => type.to === null)).toBe(true)
    expect(types.map((type) => type.from)).toEqual(['due_date', 'due_date', 'due_date'])
  })
})

describe('syncViewFor', () => {
  test('idle reads as syncing with no result yet', () => {
    expect(syncViewFor({ phase: 'idle' }, SYNCED_AT)).toEqual({ state: 'syncing', hasResult: false })
  })

  test('syncing with a previous result keeps hasResult true', () => {
    const syncing: SchemaSnapshot = { phase: 'syncing', last: SYNCED.last }
    expect(syncViewFor(syncing, SYNCED_AT)).toEqual({ state: 'syncing', hasResult: true })
  })

  test.each([
    [0, { key: 'justNow' }],
    [30_000, { key: 'justNow' }],
    [90_000, { key: 'minutesAgo', count: 1 }],
    [2 * 60 * 60_000, { key: 'hoursAgo', count: 2 }],
    [3 * 24 * 60 * 60_000, { key: 'daysAgo', count: 3 }]
  ])('synced %i ms later reads as "%o"', (elapsed, elapsedDetail) => {
    expect(syncViewFor(SYNCED, SYNCED_AT + elapsed)).toEqual({
      state: 'synced',
      detail: { kind: 'elapsed', elapsed: elapsedDetail },
      hasResult: true
    })
  })

  test('failed with a stored key reason reads as key not accepted', () => {
    const failed: SchemaSnapshot = { phase: 'failed', failure: 'unauthorized', at: SYNCED_AT }
    expect(syncViewFor(failed, SYNCED_AT)).toEqual({
      state: 'error',
      detail: { kind: 'unauthorized' },
      hasResult: false
    })
  })

  test('failed unreachable reads as an Anytype connectivity problem, keeping any last result', () => {
    const failed: SchemaSnapshot = {
      phase: 'failed',
      failure: 'unreachable',
      at: SYNCED_AT,
      last: SYNCED.last
    }
    expect(syncViewFor(failed, SYNCED_AT)).toEqual({
      state: 'error',
      detail: { kind: 'unreachable' },
      hasResult: true
    })
  })
})

describe('isOnboarded', () => {
  test('false until a selection has been saved', () => {
    expect(isOnboarded({ phase: 'unset' })).toBe(false)
  })

  test('true once a selection, even an empty one, is saved', () => {
    expect(isOnboarded({ phase: 'saved', selection: { spaceIds: [], types: [], queries: [] } })).toBe(true)
  })
})

describe('picksFor', () => {
  const TYPES: ObjectType[] = [
    {
      key: 'sp_1:task',
      space: 'sp_1',
      label: 'Task',
      category: 'sage',
      icon: 'check',
      props: [
        { key: 'due_date', label: 'Due date' },
        { key: 'start_date', label: 'Start date' }
      ],
      selects: [{ key: 'priority', label: 'Priority' }],
      checkboxes: [{ key: 'done', label: 'Done' }],
      texts: [],
      panelProps: [],
      from: 'due_date',
      to: null,
      includesTime: false,
      colourBy: null,
      ...TASK_DETAILS
    }
  ]

  test('is empty before onboarding is done', () => {
    expect(picksFor({ phase: 'unset' }, TYPES)).toEqual({ spaceKeys: [], typeKeys: [], dates: {} })
  })

  test('carries a saved pick whose dates the type still offers', () => {
    const selection: SchemaSelectionSnapshot = {
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1'],
        types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'start_date', to: null, includesTime: true, colourBy: null, ...TASK_DETAILS }],
        queries: []
      }
    }
    expect(picksFor(selection, TYPES)).toEqual({
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'start_date', to: null, includesTime: true, colourBy: null, view: null, ...TASK_DETAILS } }
    })
  })

  test('carries the property it colours by, or colours by nothing once that is gone', () => {
    const saved = (colourBy: string): SchemaSelectionSnapshot => ({
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1'],
        types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy, ...TASK_DETAILS }],
        queries: []
      }
    })
    expect(picksFor(saved('priority'), TYPES).dates['sp_1:task']?.colourBy).toBe('priority')
    expect(picksFor(saved('gone'), TYPES).dates['sp_1:task']).toEqual({
      from: 'due_date',
      to: null,
      includesTime: false,
      colourBy: null,
      view: null,
      ...TASK_DETAILS
    })
  })

  test('still ticks a type whose saved dates it no longer offers, without a dates entry', () => {
    const selection: SchemaSelectionSnapshot = {
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1'],
        types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'gone_date', to: null, includesTime: false, colourBy: null, ...TASK_DETAILS }],
        queries: []
      }
    }
    expect(picksFor(selection, TYPES)).toEqual({
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: {}
    })
  })

  test('still ticks a type the current sync did not see at all', () => {
    const selection: SchemaSelectionSnapshot = {
      phase: 'saved',
      selection: {
        spaceIds: [],
        types: [{ spaceId: 'sp_1', typeKey: 'ghost', from: 'due_date', to: null, includesTime: false, colourBy: null, ...TASK_DETAILS }],
        queries: []
      }
    }
    expect(picksFor(selection, TYPES)).toEqual({
      spaceKeys: [],
      typeKeys: ['sp_1:ghost'],
      dates: {}
    })
  })
})

describe('schemaSelectionFor', () => {
  test('saves a picked type on its own dates by default', () => {
    const picks: TypePicks = { spaceKeys: ['sp_1'], typeKeys: ['sp_1:task'], dates: {} }
    expect(schemaSelectionFor(SYNCED, picks, { phase: 'unset' })).toEqual({
      spaceIds: ['sp_1'],
      types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy: null, ...TASK_DETAILS }],
      queries: []
    })
  })

  test('honors a picked date mapping the type still offers', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'start_date', to: null, includesTime: true, colourBy: null, view: null, ...TASK_DETAILS } }
    }
    expect(schemaSelectionFor(SYNCED, picks, { phase: 'unset' })).toEqual({
      spaceIds: ['sp_1'],
      types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'start_date', to: null, includesTime: true, colourBy: null, ...TASK_DETAILS }],
      queries: []
    })
  })

  test('saves the property a type is coloured by', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'due_date', to: null, includesTime: false, colourBy: 'priority', view: null, ...TASK_DETAILS } }
    }
    expect(schemaSelectionFor(SYNCED, picks, { phase: 'unset' }).types[0]?.colourBy).toBe('priority')
  })

  test('falls back to the type\'s own dates when the picked mapping no longer applies', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'gone_date', to: null, includesTime: true, colourBy: null, view: null, ...TASK_DETAILS } }
    }
    expect(schemaSelectionFor(SYNCED, picks, { phase: 'unset' })).toEqual({
      spaceIds: ['sp_1'],
      types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy: null, ...TASK_DETAILS }],
      queries: []
    })
  })

  test('saves the panel, Done and Location picked for a type', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: {
        'sp_1:task': {
          from: 'due_date',
          to: null,
          includesTime: false,
          colourBy: null,
          view: null,
          panel: ['project', 'venue'],
          done: null,
          location: 'venue'
        }
      }
    }
    expect(schemaSelectionFor(SYNCED, picks, { phase: 'unset' }).types[0]).toMatchObject({
      panel: ['project', 'venue'],
      done: null,
      location: 'venue'
    })
  })

  test('drops an unticked type this sync saw, but keeps one it did not see untouched', () => {
    const previous: SchemaSelectionSnapshot = {
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1', 'sp_9'],
        types: [
          { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy: null, ...TASK_DETAILS },
          { spaceId: 'sp_9', typeKey: 'ghost', from: 'x_date', to: null, includesTime: false, colourBy: null, ...TASK_DETAILS }
        ],
        queries: []
      }
    }
    const picks: TypePicks = { spaceKeys: ['sp_1'], typeKeys: ['sp_1:task'], dates: {} }

    expect(schemaSelectionFor(SYNCED, picks, previous)).toEqual({
      spaceIds: ['sp_9', 'sp_1'],
      types: [
        { spaceId: 'sp_9', typeKey: 'ghost', from: 'x_date', to: null, includesTime: false, colourBy: null, ...TASK_DETAILS },
        { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy: null, ...TASK_DETAILS }
      ],
      queries: []
    })
  })
})

describe('queries', () => {
  const QUERY_SPACE: SchemaSpace = {
    ...SPACE,
    queries: [
      {
        id: 'q_open',
        name: 'Open tasks',
        typeKey: 'task',
        views: [
          { id: 'v_open', name: 'Open' },
          { id: 'v_all', name: 'All' }
        ]
      }
    ]
  }
  const WITH_QUERY: SchemaSnapshot = {
    phase: 'synced',
    last: { spaces: [QUERY_SPACE], hasNotGrantedSpaces: false, syncedAt: SYNCED_AT }
  }
  const QUERY_KEY = 'sp_1:query:q_open'
  const OPEN_TASKS: SchemaQueryChoice = {
    spaceId: 'sp_1',
    queryId: 'q_open',
    viewId: 'v_all',
    from: 'start_date',
    to: null,
    includesTime: true,
    colourBy: 'priority',
    ...TASK_DETAILS
  }
  const saved = (...queries: SchemaQueryChoice[]): SchemaSelectionSnapshot => ({
    phase: 'saved',
    selection: { spaceIds: ['sp_1'], types: [], queries }
  })

  test("lists a query after its space's types, in its type's hue, with its views", () => {
    const types = typesFor(WITH_QUERY)
    expect(types.map(({ key }) => key)).toEqual(['sp_1:task', 'sp_1:note', 'sp_1:idea', QUERY_KEY])
    expect(types[3]).toEqual({
      key: QUERY_KEY,
      space: 'sp_1',
      label: 'Open tasks',
      category: 'sage',
      icon: 'funnel',
      query: {
        typeKey: 'sp_1:task',
        typeLabel: 'Task',
        views: [
          { key: 'v_open', label: 'Open' },
          { key: 'v_all', label: 'All' }
        ]
      },
      props: [
        { key: 'due_date', label: 'Due date' },
        { key: 'start_date', label: 'Start date' }
      ],
      selects: [{ key: 'priority', label: 'Priority' }],
      checkboxes: [{ key: 'done', label: 'Done' }],
      texts: [{ key: 'venue', label: 'Venue' }],
      panelProps: [
        { key: 'venue', label: 'Venue', format: 'text' },
        { key: 'project', label: 'Project', format: 'objects' }
      ],
      from: 'due_date',
      to: null,
      includesTime: false,
      colourBy: null,
      ...TASK_DETAILS
    })
    expect(querySourceKey('sp_1', 'q_open')).toBe(QUERY_KEY)
  })

  test('is tracked like a type', () => {
    expect(tracksAnyType(saved(OPEN_TASKS))).toBe(true)
  })

  test('carries a saved query as a pick, with its view', () => {
    expect(picksFor(saved(OPEN_TASKS), typesFor(WITH_QUERY))).toEqual({
      spaceKeys: ['sp_1'],
      typeKeys: [QUERY_KEY],
      dates: {
        [QUERY_KEY]: { from: 'start_date', to: null, includesTime: true, colourBy: 'priority', view: 'v_all', ...TASK_DETAILS }
      }
    })
  })

  test('reads the first view once the chosen one is gone, keeping the dates', () => {
    const picks = picksFor(saved({ ...OPEN_TASKS, viewId: 'v_gone' }), typesFor(WITH_QUERY))
    expect(picks.dates[QUERY_KEY]).toMatchObject({ from: 'start_date', view: null })
  })

  test('saves a picked query with its view', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: [QUERY_KEY],
      dates: {
        [QUERY_KEY]: { from: 'start_date', to: null, includesTime: true, colourBy: 'priority', view: 'v_all', ...TASK_DETAILS }
      }
    }
    expect(schemaSelectionFor(WITH_QUERY, picks, { phase: 'unset' })).toEqual({
      spaceIds: ['sp_1'],
      types: [],
      queries: [OPEN_TASKS]
    })
  })

  test('saves a picked query with no view picked as reading its first, on its own dates', () => {
    const picks: TypePicks = { spaceKeys: ['sp_1'], typeKeys: [QUERY_KEY], dates: {} }
    expect(schemaSelectionFor(WITH_QUERY, picks, { phase: 'unset' }).queries).toEqual([
      { ...OPEN_TASKS, viewId: null, from: 'due_date', includesTime: false, colourBy: null }
    ])
  })

  test("saves a query nothing was picked for with its type's panel, Done and Location", () => {
    const typeMapping = {
      from: 'due_date',
      to: null,
      includesTime: false,
      colourBy: null,
      view: null,
      panel: ['project'],
      done: null,
      location: 'venue'
    }
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task', QUERY_KEY],
      dates: { 'sp_1:task': typeMapping }
    }
    expect(schemaSelectionFor(WITH_QUERY, picks, { phase: 'unset' }).queries[0]).toMatchObject({
      panel: ['project'],
      done: null,
      location: 'venue'
    })
  })

  test('drops an unticked query this sync saw, but keeps one it did not see untouched', () => {
    const unseen = { ...OPEN_TASKS, queryId: 'q_ghost' }
    const picks: TypePicks = { spaceKeys: ['sp_1'], typeKeys: [], dates: {} }
    expect(schemaSelectionFor(WITH_QUERY, picks, saved(OPEN_TASKS, unseen)).queries).toEqual([unseen])
  })
})
