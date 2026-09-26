import { expect, test } from 'vitest'
import type { SchemaSync, SchemaTypeChoice } from '@anytype-calendar/schema/domain'
import { eventsSourcesFor } from './event-sources'

const TASK: SchemaTypeChoice = {
  spaceId: 'sp_1',
  typeKey: 'task',
  from: 'due_date',
  to: null,
  includesTime: true,
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
        ]
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
          ]
        }
      },
      { phase: 'idle' }
    )
  ).toEqual([
    { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: true },
    { spaceId: 'sp_1', typeKey: 'project', from: 'start_date', to: 'due_date', includesTime: false }
  ])
})

test('reads Done, Location and the chosen colours where the synced type has them', () => {
  expect(eventsSourcesFor({ phase: 'saved', selection: { spaceIds: ['sp_1'], types: [TASK] } }, SYNCED)).toEqual([
    {
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
    { phase: 'saved', selection: { spaceIds: ['sp_1'], types: [{ ...TASK, colourBy: 'gone' }] } },
    SYNCED
  )
  expect(source).not.toHaveProperty('colourBy')
})
