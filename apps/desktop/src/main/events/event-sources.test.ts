import { expect, test } from 'vitest'
import { eventsSourcesFor } from './event-sources'

test('is empty until a selection is saved', () => {
  expect(eventsSourcesFor({ phase: 'unset' })).toEqual([])
})

test('keeps the chosen types of chosen spaces only', () => {
  expect(
    eventsSourcesFor({
      phase: 'saved',
      selection: {
        spaceIds: ['sp_1'],
        types: [
          { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: true },
          { spaceId: 'sp_2', typeKey: 'task', from: 'due_date', to: null, includesTime: true },
          {
            spaceId: 'sp_1',
            typeKey: 'project',
            from: 'start_date',
            to: 'due_date',
            includesTime: false
          }
        ]
      }
    })
  ).toEqual([
    { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null, includesTime: true },
    { spaceId: 'sp_1', typeKey: 'project', from: 'start_date', to: 'due_date', includesTime: false }
  ])
})
