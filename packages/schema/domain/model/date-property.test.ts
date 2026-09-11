import { expect, test } from 'vitest'
import { userDatePropertyKeys } from './date-property'

test('keeps the date properties the user fills in', () => {
  expect(
    userDatePropertyKeys([
      { key: 'due_date', name: 'Due date', format: 'date' },
      { key: 'applied', name: 'Applied on', format: 'date' }
    ])
  ).toEqual(['due_date', 'applied'])
})

test('leaves out the dates Anytype sets on every object', () => {
  expect(
    userDatePropertyKeys([
      { key: 'created_date', name: 'Creation date', format: 'date' },
      { key: 'last_modified_date', name: 'Last modified date', format: 'date' },
      { key: 'last_opened_date', name: 'Last opened date', format: 'date' },
      { key: 'added_date', name: 'Added date', format: 'date' },
      { key: 'last_message_date', name: 'Last message date', format: 'date' }
    ])
  ).toEqual([])
})

test('leaves out properties of any other format', () => {
  expect(
    userDatePropertyKeys([
      { key: 'status', name: 'Status', format: 'select' },
      { key: 'released_year', name: 'Released year', format: 'number' }
    ])
  ).toEqual([])
})
