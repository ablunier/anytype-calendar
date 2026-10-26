import { expect, test } from 'vitest'
import type { SchemaQueryChoice, SchemaSelection, SchemaTypeChoice } from '../../domain'
import {
  JsonFileSchemaSelectionRepository,
  type SchemaSelectionFile
} from './json-file-schema-selection-repository'

/** How a choice saved before `panel`, `done` and `location` existed reads. */
const DRAWN_BEFORE = { panel: [], done: 'done', location: 'location' }

const SELECTION: SchemaSelection = {
  spaceIds: ['sp_1'],
  types: [
    {
      spaceId: 'sp_1',
      typeKey: 'project',
      from: 'start_date',
      to: 'finish_date',
      includesTime: false,
      colourBy: 'status',
      panel: ['priority', 'linked_projects'],
      done: null,
      location: 'venue'
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
      colourBy: null,
      panel: [],
      done: 'done',
      location: null
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
  expect(JSON.parse(contents() ?? '')).toEqual({ version: 5, selection: SELECTION })
})

const [{ colourBy: _, panel: _panel, done: _done, location: _location, ...V2_CHOICE }] =
  SELECTION.types as [SchemaTypeChoice]
const V3_CHOICE = { ...V2_CHOICE, colourBy: 'status' }

test('loads a version-2 file as colouring by nothing, and choosing no query', async () => {
  const { repository } = setup(
    JSON.stringify({ version: 2, selection: { spaceIds: SELECTION.spaceIds, types: [V2_CHOICE] } })
  )
  await expect(repository.load()).resolves.toEqual({
    ...SELECTION,
    types: [{ ...V2_CHOICE, colourBy: null, ...DRAWN_BEFORE }],
    queries: []
  })
})

test('loads a version-3 file as choosing no query', async () => {
  const { repository } = setup(
    JSON.stringify({ version: 3, selection: { spaceIds: SELECTION.spaceIds, types: [V3_CHOICE] } })
  )
  await expect(repository.load()).resolves.toEqual({
    ...SELECTION,
    types: [{ ...V3_CHOICE, ...DRAWN_BEFORE }],
    queries: []
  })
})

test("loads a version-4 file as showing nothing more, with Anytype's own Done and Location", async () => {
  const { panel: _p, done: _d, location: _l, ...query } = SELECTION.queries[0] as SchemaQueryChoice
  const { repository } = setup(
    JSON.stringify({
      version: 4,
      selection: { spaceIds: SELECTION.spaceIds, types: [V3_CHOICE], queries: [query] }
    })
  )
  await expect(repository.load()).resolves.toEqual({
    ...SELECTION,
    types: [{ ...V3_CHOICE, ...DRAWN_BEFORE }],
    queries: [{ ...query, ...DRAWN_BEFORE }]
  })
})

test('loads no selection when there is no file', async () => {
  await expect(setup(null).repository.load()).resolves.toBeNull()
})

test.each([
  ['not JSON', '{'],
  ['not an object', '"selection"'],
  ['another version', JSON.stringify({ version: 1, selection: SELECTION })],
  ['no version', JSON.stringify({ selection: SELECTION })],
  ['not a selection', JSON.stringify({ version: 5, selection: { spaceIds: 'sp_1' } })]
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
