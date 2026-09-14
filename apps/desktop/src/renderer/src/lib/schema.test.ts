import { describe, expect, test } from 'vitest'
import type { SchemaSpace, SchemaType } from '@anytype-calendar/schema/domain'
import type { SchemaSelectionSnapshot, SchemaSnapshot } from '@shared/ipc'
import type { ObjectType, TypePicks } from '@renderer/types'
import {
  elapsedSince,
  isOnboarded,
  objectTypeKey,
  picksFor,
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
  datedObjectCount: 5
}

const UNKNOWN_ICON_TYPE: SchemaType = {
  key: 'note',
  name: 'Note',
  icon: { name: 'mystery-icon', color: 'mystery-color' },
  dateProperties: [DUE],
  datedObjectCount: 2
}

const NO_ICON_TYPE: SchemaType = {
  key: 'idea',
  name: 'Idea',
  icon: null,
  dateProperties: [DUE],
  datedObjectCount: 1
}

const SPACE: SchemaSpace = {
  id: 'sp_1',
  name: 'Personal',
  types: [TASK_TYPE, UNKNOWN_ICON_TYPE, NO_ICON_TYPE],
  datedObjectCount: 8
}

const SYNCED_AT = 100_000
const SYNCED: SchemaSnapshot = { phase: 'synced', last: { spaces: [SPACE], syncedAt: SYNCED_AT } }

describe('tracksAnyType', () => {
  const task = { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false }

  test('is false until a selection is saved', () => {
    expect(tracksAnyType({ phase: 'unset' })).toBe(false)
  })

  test('is true for a chosen type in a chosen space', () => {
    expect(tracksAnyType({ phase: 'saved', selection: { spaceIds: ['sp_1'], types: [task] } })).toBe(true)
  })

  test('is false when the only chosen type sits in a space no longer chosen', () => {
    expect(tracksAnyType({ phase: 'saved', selection: { spaceIds: ['sp_2'], types: [task] } })).toBe(false)
    expect(tracksAnyType({ phase: 'saved', selection: { spaceIds: [], types: [] } })).toBe(false)
  })
})

describe('objectTypeKey', () => {
  test('is the key typesFor gives the type', () => {
    expect(objectTypeKey('sp_1', 'task')).toBe(typesFor(SYNCED)[0]?.key)
  })
})

describe('elapsedSince', () => {
  test('rounds down to the largest unit', () => {
    expect(elapsedSince(0, 59_000)).toBe('just now')
    expect(elapsedSince(0, 3 * 60_000)).toBe('3 min ago')
    expect(elapsedSince(0, 5 * 3_600_000)).toBe('5 h ago')
    expect(elapsedSince(0, 2 * 86_400_000)).toBe('2 d ago')
  })
})

describe('spacesFor', () => {
  test('is empty before any successful sync', () => {
    expect(spacesFor({ phase: 'idle' })).toEqual([])
  })

  test('maps each synced space, counting only dated objects', () => {
    expect(spacesFor(SYNCED)).toEqual([{ key: 'sp_1', name: 'Personal', objects: 8 }])
  })

  test('keeps the last result while a new sync is failing', () => {
    const failed: SchemaSnapshot = { phase: 'failed', failure: 'unreachable', at: 200_000, last: SYNCED.last }
    expect(spacesFor(failed)).toEqual([{ key: 'sp_1', name: 'Personal', objects: 8 }])
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
      count: 5,
      props: [
        { key: 'due_date', label: 'Due date' },
        { key: 'start_date', label: 'Start date' }
      ],
      from: 'due_date',
      to: null,
      includesTime: false
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
    [0, 'just now'],
    [30_000, 'just now'],
    [90_000, '1 min ago'],
    [2 * 60 * 60_000, '2 h ago'],
    [3 * 24 * 60 * 60_000, '3 d ago']
  ])('synced %i ms later reads as "%s"', (elapsed, detail) => {
    expect(syncViewFor(SYNCED, SYNCED_AT + elapsed)).toEqual({ state: 'synced', detail, hasResult: true })
  })

  test('failed with a stored key reason reads as key not accepted', () => {
    const failed: SchemaSnapshot = { phase: 'failed', failure: 'unauthorized', at: SYNCED_AT }
    expect(syncViewFor(failed, SYNCED_AT)).toEqual({
      state: 'error',
      detail: 'Key not accepted',
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
      detail: 'Is Anytype running?',
      hasResult: true
    })
  })
})

describe('isOnboarded', () => {
  test('false until a selection has been saved', () => {
    expect(isOnboarded({ phase: 'unset' })).toBe(false)
  })

  test('true once a selection, even an empty one, is saved', () => {
    expect(isOnboarded({ phase: 'saved', selection: { spaceIds: [], types: [] } })).toBe(true)
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
      count: 5,
      props: [
        { key: 'due_date', label: 'Due date' },
        { key: 'start_date', label: 'Start date' }
      ],
      from: 'due_date',
      to: null,
      includesTime: false
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
        types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'start_date', to: null, includesTime: true }]
      }
    }
    expect(picksFor(selection, TYPES)).toEqual({
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'start_date', to: null, includesTime: true } }
    })
  })

  test('still ticks a type whose saved dates it no longer offers, without a dates entry', () => {
    const selection: SchemaSelectionSnapshot = {
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1'],
        types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'gone_date', to: null, includesTime: false }]
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
        types: [{ spaceId: 'sp_1', typeKey: 'ghost', from: 'due_date', to: null, includesTime: false }]
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
      types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false }]
    })
  })

  test('honors a picked date mapping the type still offers', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'start_date', to: null, includesTime: true } }
    }
    expect(schemaSelectionFor(SYNCED, picks, { phase: 'unset' })).toEqual({
      spaceIds: ['sp_1'],
      types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'start_date', to: null, includesTime: true }]
    })
  })

  test('falls back to the type\'s own dates when the picked mapping no longer applies', () => {
    const picks: TypePicks = {
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task'],
      dates: { 'sp_1:task': { from: 'gone_date', to: null, includesTime: true } }
    }
    expect(schemaSelectionFor(SYNCED, picks, { phase: 'unset' })).toEqual({
      spaceIds: ['sp_1'],
      types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false }]
    })
  })

  test('drops an unticked type this sync saw, but keeps one it did not see untouched', () => {
    const previous: SchemaSelectionSnapshot = {
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1', 'sp_9'],
        types: [
          { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false },
          { spaceId: 'sp_9', typeKey: 'ghost', from: 'x_date', to: null, includesTime: false }
        ]
      }
    }
    const picks: TypePicks = { spaceKeys: ['sp_1'], typeKeys: ['sp_1:task'], dates: {} }

    expect(schemaSelectionFor(SYNCED, picks, previous)).toEqual({
      spaceIds: ['sp_9', 'sp_1'],
      types: [
        { spaceId: 'sp_9', typeKey: 'ghost', from: 'x_date', to: null, includesTime: false },
        { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: false }
      ]
    })
  })
})
