import { expect, test } from 'vitest'
import { linkedEventsIds, toEventsDetails, type EventsLinkedObject, type EventsPanelProperty } from './detail'

const RED = { name: 'Applied', color: 'red' }
const BLUE = { name: 'Remote', color: 'blue' }

const PANEL: EventsPanelProperty[] = [
  { key: 'salary', format: 'text' },
  { key: 'status', format: 'select', options: [RED] },
  { key: 'tags', format: 'multi_select', options: [RED, BLUE] },
  { key: 'contacts', format: 'objects' },
  { key: 'openings', format: 'number' }
]

const LINKED: Record<string, EventsLinkedObject> = {
  obj_1: { id: 'obj_1', name: 'Acme', member: false },
  'participant-A8x': { id: 'participant-A8x', name: 'Mara', member: true }
}
const linked = (id: string): EventsLinkedObject | undefined => LINKED[id]

test("draws each value in the panel's order, whatever order the row gives them in", () => {
  expect(
    toEventsDetails(
      [
        { key: 'openings', format: 'number', value: 2 },
        { key: 'contacts', format: 'objects', ids: ['participant-A8x', 'obj_1'] },
        { key: 'tags', format: 'multi_select', names: ['Remote', 'Applied'] },
        { key: 'status', format: 'select', names: ['Applied'] },
        { key: 'salary', format: 'text', value: '40–50k' }
      ],
      PANEL,
      linked
    )
  ).toEqual([
    { key: 'salary', format: 'text', value: '40–50k' },
    { key: 'status', format: 'select', options: [RED] },
    { key: 'tags', format: 'multi_select', options: [BLUE, RED] },
    { key: 'contacts', format: 'objects', objects: [LINKED['participant-A8x'], LINKED.obj_1] },
    { key: 'openings', format: 'number', value: 2 }
  ])
})

test('leaves out an option the property does not have, such as a deleted one served by its id', () => {
  expect(
    toEventsDetails([{ key: 'tags', format: 'multi_select', names: ['bafyreideleted', 'Remote'] }], PANEL, linked)
  ).toEqual([{ key: 'tags', format: 'multi_select', options: [BLUE] }])
})

test('leaves out a property with nothing left to show', () => {
  expect(
    toEventsDetails(
      [
        { key: 'status', format: 'select', names: ['bafyreideleted'] },
        { key: 'contacts', format: 'objects', ids: ['obj_gone'] }
      ],
      PANEL,
      linked
    )
  ).toEqual([])
})

test('leaves out a value read for a property the panel does not show, or in another format', () => {
  expect(
    toEventsDetails(
      [
        { key: 'notes', format: 'text', value: 'x' },
        { key: 'openings', format: 'text', value: 'two' }
      ],
      PANEL,
      linked
    )
  ).toEqual([])
})

test('lists the ids linked to, each once', () => {
  expect(
    linkedEventsIds([
      { key: 'a', format: 'objects', ids: ['obj_1', 'obj_2'] },
      { key: 'b', format: 'text', value: 'obj_3' },
      { key: 'c', format: 'objects', ids: ['obj_2'] }
    ])
  ).toEqual(['obj_1', 'obj_2'])
})
