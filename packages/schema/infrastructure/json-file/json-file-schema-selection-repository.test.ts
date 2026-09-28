import { expect, test } from 'vitest'
import type { SchemaSelection, SchemaTypeChoice } from '../../domain'
import {
  JsonFileSchemaSelectionRepository,
  type SchemaSelectionFile
} from './json-file-schema-selection-repository'

const SELECTION: SchemaSelection = {
  spaceIds: ['sp_1'],
  types: [
    {
      spaceId: 'sp_1',
      typeKey: 'project',
      from: 'start_date',
      to: 'finish_date',
      includesTime: false,
      colourBy: 'status'
    }
  ],
  queries: [
    {
      spaceId: 'sp_1',
      queryId: 'bafyquery',
      viewId: '63194',
      from: 'due_date',
      to: null,
      includesTime: true,
      colourBy: null
    }
  ]
}

function setup(initial: string | null = null) {
  let contents = initial
  const file: SchemaSelectionFile = {
    read: async () => contents,
    write: async (text) => {
      contents = text
    }
  }
  return { repository: new JsonFileSchemaSelectionRepository(file), contents: () => contents }
}

test('loads what it saved', async () => {
  const { repository } = setup()
  await repository.save(SELECTION)
  await expect(repository.load()).resolves.toEqual(SELECTION)
})

test('writes the selection under a format version', async () => {
  const { repository, contents } = setup()
  await repository.save(SELECTION)
  expect(JSON.parse(contents() ?? '')).toEqual({ version: 4, selection: SELECTION })
})

test('loads a version-2 file as colouring by nothing, and choosing no query', async () => {
  const [{ colourBy: _, ...choice }] = SELECTION.types as [SchemaTypeChoice]
  const { repository } = setup(
    JSON.stringify({ version: 2, selection: { spaceIds: SELECTION.spaceIds, types: [choice] } })
  )
  await expect(repository.load()).resolves.toEqual({
    ...SELECTION,
    types: [{ ...choice, colourBy: null }],
    queries: []
  })
})

test('loads a version-3 file as choosing no query', async () => {
  const { repository } = setup(
    JSON.stringify({ version: 3, selection: { spaceIds: SELECTION.spaceIds, types: SELECTION.types } })
  )
  await expect(repository.load()).resolves.toEqual({ ...SELECTION, queries: [] })
})

test('loads no selection when there is no file', async () => {
  await expect(setup(null).repository.load()).resolves.toBeNull()
})

test.each([
  ['not JSON', '{'],
  ['not an object', '"selection"'],
  ['another version', JSON.stringify({ version: 1, selection: SELECTION })],
  ['no version', JSON.stringify({ selection: SELECTION })],
  ['not a selection', JSON.stringify({ version: 4, selection: { spaceIds: 'sp_1' } })]
])('loads no selection from a file that is %s', async (_, text) => {
  await expect(setup(text).repository.load()).resolves.toBeNull()
})

test('loads no selection when the file cannot be read', async () => {
  const repository = new JsonFileSchemaSelectionRepository({
    read: async () => {
      throw new Error('EACCES')
    },
    write: async () => {}
  })
  await expect(repository.load()).resolves.toBeNull()
})
