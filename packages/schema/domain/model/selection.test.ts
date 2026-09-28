import { describe, expect, test } from 'vitest'
import {
  EMPTY_SCHEMA_SELECTION,
  rekeySchemaSelection,
  toSchemaSelection,
  type SchemaQueryChoice,
  type SchemaSelection,
  type SchemaTypeChoice
} from './selection'
import type { SchemaSpace } from './space'

const TASK: SchemaTypeChoice = {
  spaceId: 'sp_1',
  typeKey: 'task',
  from: 'due_date',
  to: null,
  includesTime: false,
  colourBy: null
}
const PROJECT: SchemaTypeChoice = {
  spaceId: 'sp_1',
  typeKey: 'project',
  from: 'start_date',
  to: 'finish_date',
  includesTime: true,
  colourBy: '6aaa450259c0801cdafc4015'
}

const OPEN_TASKS: SchemaQueryChoice = {
  spaceId: 'sp_1',
  queryId: 'bafyquery',
  viewId: '63194',
  from: 'due_date',
  to: null,
  includesTime: true,
  colourBy: null
}

describe('toSchemaSelection', () => {
  test('accepts a well-formed selection', () => {
    const selection = { spaceIds: ['sp_1'], types: [TASK, PROJECT], queries: [OPEN_TASKS] }
    expect(toSchemaSelection(selection)).toEqual(selection)
  })

  test('reads a query read through its first view', () => {
    const selection = { spaceIds: [], types: [], queries: [{ ...OPEN_TASKS, viewId: null }] }
    expect(toSchemaSelection(selection)).toEqual(selection)
  })

  test('reads a selection saved before there were queries as choosing none', () => {
    expect(toSchemaSelection({ spaceIds: ['sp_1'], types: [TASK] })).toEqual({
      spaceIds: ['sp_1'],
      types: [TASK],
      queries: []
    })
  })

  test('accepts the empty selection', () => {
    expect(toSchemaSelection(EMPTY_SCHEMA_SELECTION)).toEqual(EMPTY_SCHEMA_SELECTION)
  })

  test('keeps only the fields it knows', () => {
    expect(
      toSchemaSelection({ spaceIds: [], types: [{ ...TASK, label: 'Task' }], queries: [], extra: true })
    ).toEqual({ spaceIds: [], types: [TASK], queries: [] })
  })

  test('reads a choice saved before colourBy as colouring by nothing', () => {
    const { colourBy: _, ...saved } = PROJECT
    expect(toSchemaSelection({ spaceIds: [], types: [saved] })).toEqual({
      spaceIds: [],
      types: [{ ...PROJECT, colourBy: null }],
      queries: []
    })
  })

  test('collapses a space listed twice', () => {
    expect(toSchemaSelection({ spaceIds: ['sp_1', 'sp_1'], types: [] })).toEqual({
      spaceIds: ['sp_1'],
      types: [],
      queries: []
    })
  })

  test('accepts the same type key in two spaces', () => {
    const selection = { spaceIds: [], types: [TASK, { ...TASK, spaceId: 'sp_2' }], queries: [] }
    expect(toSchemaSelection(selection)).toEqual(selection)
  })

  test('accepts a query and a type of the same id in one space', () => {
    const selection = {
      spaceIds: [],
      types: [{ ...TASK, typeKey: 'bafyquery' }],
      queries: [OPEN_TASKS]
    }
    expect(toSchemaSelection(selection)).toEqual(selection)
  })

  test.each([
    ['not an object', 'selection'],
    ['null', null],
    ['no space list', { types: [] }],
    ['no type list', { spaceIds: [] }],
    ['an empty space id', { spaceIds: [''], types: [] }],
    ['a non-string space id', { spaceIds: [1], types: [] }],
    ['a type that is not an object', { spaceIds: [], types: ['task'] }],
    ['a type with no space', { spaceIds: [], types: [{ ...TASK, spaceId: '' }] }],
    ['a type with no key', { spaceIds: [], types: [{ ...TASK, typeKey: undefined }] }],
    ['a type with no from date', { spaceIds: [], types: [{ ...TASK, from: '' }] }],
    ['a type with an undefined to date', { spaceIds: [], types: [{ ...TASK, to: undefined }] }],
    ['a type with an empty to date', { spaceIds: [], types: [{ ...TASK, to: '' }] }],
    ['a range from and to the same date', { spaceIds: [], types: [{ ...TASK, to: 'due_date' }] }],
    ['a type chosen twice', { spaceIds: [], types: [TASK, { ...TASK, from: 'other' }] }],
    ['a missing includesTime', { spaceIds: [], types: [{ ...TASK, includesTime: undefined }] }],
    ['a non-boolean includesTime', { spaceIds: [], types: [{ ...TASK, includesTime: 'yes' }] }],
    ['an empty colourBy', { spaceIds: [], types: [{ ...TASK, colourBy: '' }] }],
    ['a non-string colourBy', { spaceIds: [], types: [{ ...TASK, colourBy: 1 }] }],
    ['a query list that is not a list', { spaceIds: [], types: [], queries: {} }],
    ['a query with no id', { spaceIds: [], types: [], queries: [{ ...OPEN_TASKS, queryId: '' }] }],
    ['a query with no view', { spaceIds: [], types: [], queries: [{ ...OPEN_TASKS, viewId: undefined }] }],
    ['a query with an empty view', { spaceIds: [], types: [], queries: [{ ...OPEN_TASKS, viewId: '' }] }],
    ['a query with no from date', { spaceIds: [], types: [], queries: [{ ...OPEN_TASKS, from: '' }] }],
    [
      'a query chosen twice',
      { spaceIds: [], types: [], queries: [OPEN_TASKS, { ...OPEN_TASKS, viewId: null }] }
    ]
  ])('rejects %s', (_, value) => {
    expect(toSchemaSelection(value)).toBeNull()
  })
})

describe('rekeySchemaSelection', () => {
  const SPACE = 'bafy.space'
  const choice = (typeKey: string, from: string, to: string | null = null): SchemaTypeChoice => ({
    spaceId: SPACE,
    typeKey,
    from,
    to,
    includesTime: false,
    colourBy: null
  })
  const selectionOf = (...types: SchemaTypeChoice[]): SchemaSelection => ({
    spaceIds: [SPACE],
    types,
    queries: []
  })
  const spaces: SchemaSpace[] = [
    {
      id: SPACE,
      name: 'Personal',
      types: [
        {
          key: '6a67272659c08021576f3127',
          formerKey: 'book',
          name: 'Book',
          icon: null,
          dateProperties: [
            { key: 'start_date', name: 'Start date' },
            { key: '6a6733dc59c08021576f32d2', formerKey: 'finished', name: 'Finished' }
          ],
          hasDone: false,
          hasLocation: false,
          selectProperties: [
            {
              key: '6a6725f159c08021576f3119',
              formerKey: 'status',
              name: 'Status',
              options: [{ name: 'Reading', color: 'teal' }]
            }
          ]
        },
        {
          key: 'task',
          name: 'Task',
          icon: null,
          dateProperties: [{ key: 'due_date', name: 'Due date' }],
          hasDone: true,
          hasLocation: false,
          selectProperties: []
        }
      ],
      queries: []
    }
  ]

  test('returns the selection itself when every key is current', () => {
    const selection = selectionOf(choice('task', 'due_date'))
    expect(rekeySchemaSelection(selection, spaces)).toBe(selection)
  })

  test("rewrites a type and its properties from v1's spelling to the current one", () => {
    expect(rekeySchemaSelection(selectionOf(choice('book', 'start_date', 'finished')), spaces)).toEqual(
      selectionOf(choice('6a67272659c08021576f3127', 'start_date', '6a6733dc59c08021576f32d2'))
    )
  })

  test('rewrites a property of a type whose key is current', () => {
    const selection = selectionOf(choice('6a67272659c08021576f3127', 'finished'))
    expect(rekeySchemaSelection(selection, spaces).types[0]?.from).toBe('6a6733dc59c08021576f32d2')
  })

  test('rewrites the property it colours by', () => {
    const selection = selectionOf({ ...choice('book', 'start_date'), colourBy: 'status' })
    expect(rekeySchemaSelection(selection, spaces).types[0]?.colourBy).toBe('6a6725f159c08021576f3119')
  })

  test('keeps a choice whose type or space the account does not have', () => {
    const selection = selectionOf(choice('recipe', 'cooked'), { ...choice('book', 'x'), spaceId: 'other' })
    expect(rekeySchemaSelection(selection, spaces)).toBe(selection)
  })

  test('drops a former-keyed choice of a type already chosen under its current key', () => {
    const current = choice('6a67272659c08021576f3127', 'start_date')
    expect(rekeySchemaSelection(selectionOf(current, choice('book', 'finished')), spaces)).toEqual(
      selectionOf(current)
    )
  })

  test('keeps the other fields of a choice', () => {
    const selection = {
      spaceIds: [SPACE, 'x'],
      types: [{ ...choice('book', 'start_date'), includesTime: true }],
      queries: []
    }
    const rekeyed = rekeySchemaSelection(selection, spaces)
    expect(rekeyed.spaceIds).toEqual([SPACE, 'x'])
    expect(rekeyed.types[0]).toMatchObject({ spaceId: SPACE, includesTime: true })
  })

  test('leaves query choices alone, and keeps them through a rewrite of the types', () => {
    const query: SchemaQueryChoice = {
      spaceId: SPACE,
      queryId: 'bafyquery',
      viewId: null,
      from: 'finished',
      to: null,
      includesTime: false,
      colourBy: null
    }
    const selection = { ...selectionOf(choice('book', 'start_date')), queries: [query] }
    expect(rekeySchemaSelection(selection, spaces).queries).toEqual([query])
  })
})
