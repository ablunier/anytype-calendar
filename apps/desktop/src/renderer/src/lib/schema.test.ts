import { describe, expect, test } from 'vitest'
import type { SchemaQueryChoice, SchemaSpace, SchemaType } from '@anytype-calendar/schema/domain'
import type { SchemaSelectionSnapshot, SchemaSnapshot } from '@shared/ipc'
import type { Collection, ObjectType, TypePicks } from '@renderer/types'
import {
  anytypeTypeKeyOf,
  collectionChoices,
  collectionPicksFor,
  collectionsBySpaceFor,
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
  hasDone: true,
  hasLocation: false,
  selectProperties: [{ key: 'priority', name: 'Priority', options: [{ name: 'P1', color: 'red' }] }]
}

const UNKNOWN_ICON_TYPE: SchemaType = {
  key: 'note',
  name: 'Note',
  icon: { name: 'mystery-icon', color: 'mystery-color' },
  dateProperties: [DUE],
  hasDone: false,
  hasLocation: false,
  selectProperties: []
}

const NO_ICON_TYPE: SchemaType = {
  key: 'idea',
  name: 'Idea',
  icon: null,
  dateProperties: [DUE],
  hasDone: false,
  hasLocation: false,
  selectProperties: []
}

const SPACE: SchemaSpace = {
  id: 'sp_1',
  name: 'Personal',
  types: [TASK_TYPE, UNKNOWN_ICON_TYPE, NO_ICON_TYPE],
  queries: [],
  collections: []
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
  const task = { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy: null }

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
      from: 'due_date',
      to: null,
      includesTime: false,
      colourBy: null
    })
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
      from: 'due_date',
      to: null,
      includesTime: false,
      colourBy: null
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
        types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'start_date', to: null, includesTime: true, colourBy: null }],
        queries: []
      }
    }
    expect(picksFor(selection, TYPES)).toEqual({
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'start_date', to: null, includesTime: true, colourBy: null, view: null } }
    })
  })

  test('carries the property it colours by, or colours by nothing once that is gone', () => {
    const saved = (colourBy: string): SchemaSelectionSnapshot => ({
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1'],
        types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy }],
        queries: []
      }
    })
    expect(picksFor(saved('priority'), TYPES).dates['sp_1:task']?.colourBy).toBe('priority')
    expect(picksFor(saved('gone'), TYPES).dates['sp_1:task']).toEqual({
      from: 'due_date',
      to: null,
      includesTime: false,
      colourBy: null,
      view: null
    })
  })

  test('still ticks a type whose saved dates it no longer offers, without a dates entry', () => {
    const selection: SchemaSelectionSnapshot = {
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1'],
        types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'gone_date', to: null, includesTime: false, colourBy: null }],
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
        types: [{ spaceId: 'sp_1', typeKey: 'ghost', from: 'due_date', to: null, includesTime: false, colourBy: null }],
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
      types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy: null }],
      queries: []
    })
  })

  test('honors a picked date mapping the type still offers', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'start_date', to: null, includesTime: true, colourBy: null, view: null } }
    }
    expect(schemaSelectionFor(SYNCED, picks, { phase: 'unset' })).toEqual({
      spaceIds: ['sp_1'],
      types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'start_date', to: null, includesTime: true, colourBy: null }],
      queries: []
    })
  })

  test('saves the property a type is coloured by', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'due_date', to: null, includesTime: false, colourBy: 'priority', view: null } }
    }
    expect(schemaSelectionFor(SYNCED, picks, { phase: 'unset' }).types[0]?.colourBy).toBe('priority')
  })

  test('falls back to the type\'s own dates when the picked mapping no longer applies', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'gone_date', to: null, includesTime: true, colourBy: null, view: null } }
    }
    expect(schemaSelectionFor(SYNCED, picks, { phase: 'unset' })).toEqual({
      spaceIds: ['sp_1'],
      types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy: null }],
      queries: []
    })
  })

  test('drops an unticked type this sync saw, but keeps one it did not see untouched', () => {
    const previous: SchemaSelectionSnapshot = {
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1', 'sp_9'],
        types: [
          { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy: null },
          { spaceId: 'sp_9', typeKey: 'ghost', from: 'x_date', to: null, includesTime: false, colourBy: null }
        ],
        queries: []
      }
    }
    const picks: TypePicks = { spaceKeys: ['sp_1'], typeKeys: ['sp_1:task'], dates: {} }

    expect(schemaSelectionFor(SYNCED, picks, previous)).toEqual({
      spaceIds: ['sp_9', 'sp_1'],
      types: [
        { spaceId: 'sp_9', typeKey: 'ghost', from: 'x_date', to: null, includesTime: false, colourBy: null },
        { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false, colourBy: null }
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
    colourBy: 'priority'
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
      from: 'due_date',
      to: null,
      includesTime: false,
      colourBy: null
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
        [QUERY_KEY]: { from: 'start_date', to: null, includesTime: true, colourBy: 'priority', view: 'v_all' }
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
        [QUERY_KEY]: { from: 'start_date', to: null, includesTime: true, colourBy: 'priority', view: 'v_all' }
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

  test('drops an unticked query this sync saw, but keeps one it did not see untouched', () => {
    const unseen = { ...OPEN_TASKS, queryId: 'q_ghost' }
    const picks: TypePicks = { spaceKeys: ['sp_1'], typeKeys: [], dates: {} }
    expect(schemaSelectionFor(WITH_QUERY, picks, saved(OPEN_TASKS, unseen)).queries).toEqual([unseen])
  })
})

describe('collections', () => {
  const collection = (key: string, name: string, lastModified: number | null, backlinks: string[] = []): Collection => ({
    key,
    name,
    lastModified,
    backlinks
  })

  test('maps each synced space to its collections, by space key', () => {
    const snapshot: SchemaSnapshot = {
      phase: 'synced',
      last: {
        syncedAt: 0,
        hasNotGrantedSpaces: false,
        spaces: [
          { ...SPACE, collections: [{ id: 'col_1', name: 'Trip', lastModified: 5, backlinks: [] }] },
          { ...SPACE, id: 'sp_2' }
        ]
      }
    }
    expect(collectionsBySpaceFor(snapshot)).toEqual(
      new Map([
        ['sp_1', [collection('col_1', 'Trip', 5)]],
        ['sp_2', []]
      ])
    )
    expect(collectionsBySpaceFor({ phase: 'idle' })).toEqual(new Map())
  })

  test('sorts by name, and those of one name most recently modified first', () => {
    const choices = collectionChoices([
      collection('c_trip', 'Trip', 1),
      collection('c_old', 'Notes', 1, ['Home']),
      collection('c_new', 'Notes', 9, ['Work']),
      collection('c_undated', 'Notes', null, ['Desk']),
      collection('c_books', 'Books', 1)
    ])
    expect(choices.map(({ collection }) => collection.key)).toEqual(['c_books', 'c_new', 'c_old', 'c_undated', 'c_trip'])
  })

  test('tells copies of a name apart by the backlinks they do not all share, at most two then a count', () => {
    const choices = collectionChoices([
      collection('c_home', 'Notes', 2, ['Home', 'Weekly review']),
      collection('c_work', 'Notes', 1, ['Work', 'Weekly review', 'Q4', 'Desk', 'Work']),
      collection('c_trip', 'Trip', 1, ['Ignored'])
    ])
    expect(choices.map(({ hint }) => hint)).toEqual([
      { kind: 'backlinks', names: ['Home'], more: 0 },
      { kind: 'backlinks', names: ['Work', 'Q4'], more: 1 },
      null
    ])
  })

  test('falls back on when it was last modified for a copy with nothing of its own to show', () => {
    const choices = collectionChoices([
      collection('c_shared', 'Notes', 7, ['Home']),
      collection('c_never', 'Notes', null, ['Home']),
      collection('c_other', 'Notes', 1, ['Home', 'Work']),
      collection('c_bare', 'Inbox', 3),
      collection('c_bare_too', 'Inbox', 2)
    ])
    expect(Object.fromEntries(choices.map(({ collection, hint }) => [collection.key, hint]))).toEqual({
      c_shared: { kind: 'modified', at: 7 },
      c_never: null,
      c_other: { kind: 'backlinks', names: ['Work'], more: 0 },
      c_bare: { kind: 'modified', at: 3 },
      c_bare_too: { kind: 'modified', at: 2 }
    })
  })

  describe('collectionPicksFor', () => {
    const choices = collectionChoices([
      collection('c_cafe', 'Café talks', 1),
      collection('c_launch', 'Q4 launch', 1, ['Cafe']),
      collection('c_launch2', 'Q4 launch', 2, ['Home'])
    ])
    const keysFor = (query: string) =>
      collectionPicksFor(choices, query).map((pick) => (pick.kind === 'none' ? 'none' : pick.collection.key))

    test('offers None first, then every collection, when nothing is typed', () => {
      expect(keysFor('')).toEqual(['none', 'c_cafe', 'c_launch2', 'c_launch'])
      expect(keysFor('  ')).toEqual(['none', 'c_cafe', 'c_launch2', 'c_launch'])
    })

    test('matches the name ignoring case and accents, keeping None first', () => {
      expect(keysFor('cafe')).toEqual(['none', 'c_cafe'])
      expect(keysFor('CAFÉ')).toEqual(['none', 'c_cafe'])
      expect(keysFor('Launch')).toEqual(['none', 'c_launch2', 'c_launch'])
    })

    test('does not search backlinks, and keeps None when nothing matches', () => {
      expect(keysFor('home')).toEqual(['none'])
    })
  })
})
