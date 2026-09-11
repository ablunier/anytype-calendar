import { describe, expect, test } from 'vitest'
import { EMPTY_SCHEMA_SELECTION, toSchemaSelection, type SchemaTypeChoice } from './selection'

const TASK: SchemaTypeChoice = { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null }
const PROJECT: SchemaTypeChoice = {
  spaceId: 'sp_1',
  typeKey: 'project',
  from: 'start_date',
  to: 'finish_date'
}

describe('toSchemaSelection', () => {
  test('accepts a well-formed selection', () => {
    const selection = { spaceIds: ['sp_1'], types: [TASK, PROJECT] }
    expect(toSchemaSelection(selection)).toEqual(selection)
  })

  test('accepts the empty selection', () => {
    expect(toSchemaSelection(EMPTY_SCHEMA_SELECTION)).toEqual(EMPTY_SCHEMA_SELECTION)
  })

  test('keeps only the fields it knows', () => {
    expect(
      toSchemaSelection({ spaceIds: [], types: [{ ...TASK, label: 'Task' }], extra: true })
    ).toEqual({ spaceIds: [], types: [TASK] })
  })

  test('collapses a space listed twice', () => {
    expect(toSchemaSelection({ spaceIds: ['sp_1', 'sp_1'], types: [] })).toEqual({
      spaceIds: ['sp_1'],
      types: []
    })
  })

  test('accepts the same type key in two spaces', () => {
    const selection = { spaceIds: [], types: [TASK, { ...TASK, spaceId: 'sp_2' }] }
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
    ['a type chosen twice', { spaceIds: [], types: [TASK, { ...TASK, from: 'other' }] }]
  ])('rejects %s', (_, value) => {
    expect(toSchemaSelection(value)).toBeNull()
  })
})
