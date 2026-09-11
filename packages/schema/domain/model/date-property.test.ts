import { expect, test } from 'vitest'
import { userDateProperties } from './date-property'

test('keeps the date properties the user fills in, in order', () => {
  expect(
    userDateProperties([
      { key: 'due_date', name: 'Due date', format: 'date' },
      { key: 'applied', name: 'Applied on', format: 'date' }
    ])
  ).toEqual([
    { key: 'due_date', name: 'Due date' },
    { key: 'applied', name: 'Applied on' }
  ])
})

test('leaves out the dates Anytype sets on every object', () => {
  expect(
    userDateProperties([
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
    userDateProperties([
      { key: 'status', name: 'Status', format: 'select' },
      { key: 'released_year', name: 'Released year', format: 'number' }
    ])
  ).toEqual([])
})
