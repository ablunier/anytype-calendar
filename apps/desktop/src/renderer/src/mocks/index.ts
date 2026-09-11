/* Mock content for the UI pass — a typed port of the design project's screens/data.js.
 *
 * This module is imported by App.tsx and nowhere else. Every component below App takes
 * its data through props, so replacing this with an IPC-fed source in a later pass does
 * not touch a single component.
 */

import type { CalendarData, CalendarEvent, DateProperty, ObjectType, Space } from '@renderer/types'

const dates = (...labels: string[]): DateProperty[] =>
  labels.map((label) => ({ key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label }))

const SPACES: Space[] = [
  { key: 'personal', name: 'Personal', objects: 128 },
  { key: 'studio', name: 'Studio', objects: 96 },
  { key: 'reading', name: 'Reading', objects: 64 },
  { key: 'archive', name: 'Archive 2024', objects: 212 }
]

const TYPES: ObjectType[] = [
  {
    key: 'personal:task',
    space: 'personal',
    label: 'Task',
    category: 'sage',
    icon: 'check',
    count: 54,
    props: dates('Due date', 'Created date', 'Done date'),
    from: 'due_date',
    to: null
  },
  {
    key: 'personal:meeting',
    space: 'personal',
    label: 'Meeting',
    category: 'teal',
    icon: 'users',
    count: 18,
    props: dates('Start date', 'End date', 'Created date'),
    from: 'start_date',
    to: 'end_date'
  },
  {
    key: 'personal:note',
    space: 'personal',
    label: 'Note',
    category: 'dusk',
    icon: 'file-text',
    count: 31,
    props: dates('Created date', 'Last modified'),
    from: 'created_date',
    to: null
  },
  {
    key: 'personal:person',
    space: 'personal',
    label: 'Person',
    category: 'rose',
    icon: 'users',
    count: 25,
    props: dates('Custom: Meet on', 'Birthday'),
    from: 'custom_meet_on',
    to: null
  },
  {
    key: 'studio:project',
    space: 'studio',
    label: 'Project',
    category: 'ochre',
    icon: 'layers',
    count: 12,
    props: dates('Start date', 'Due date', 'Shipped on'),
    from: 'start_date',
    to: 'due_date'
  },
  {
    key: 'studio:task',
    space: 'studio',
    label: 'Task',
    category: 'sage',
    icon: 'check',
    count: 47,
    props: dates('Due date', 'Created date'),
    from: 'due_date',
    to: null
  },
  {
    key: 'studio:invoice',
    space: 'studio',
    label: 'Invoice',
    category: 'clay',
    icon: 'database',
    count: 7,
    props: dates('Issued on', 'Due date'),
    from: 'due_date',
    to: null
  },
  {
    key: 'studio:idea',
    space: 'studio',
    label: 'Idea',
    category: 'graphite',
    icon: 'star',
    count: 30,
    props: dates('Created date'),
    from: 'created_date',
    to: null
  },
  {
    key: 'reading:book',
    space: 'reading',
    label: 'Book',
    category: 'plum',
    icon: 'file-text',
    count: 22,
    props: dates('Started reading', 'Finished on'),
    from: 'started_reading',
    to: 'finished_on'
  },
  {
    key: 'reading:note',
    space: 'reading',
    label: 'Note',
    category: 'dusk',
    icon: 'file-text',
    count: 42,
    props: dates('Created date'),
    from: 'created_date',
    to: null
  },
  {
    key: 'archive:project',
    space: 'archive',
    label: 'Project',
    category: 'ochre',
    icon: 'layers',
    count: 88,
    props: dates('Start date', 'Closed on'),
    from: 'start_date',
    to: 'closed_on'
  },
  {
    key: 'archive:task',
    space: 'archive',
    label: 'Task',
    category: 'sage',
    icon: 'check',
    count: 124,
    props: dates('Due date'),
    from: 'due_date',
    to: null
  }
]

const EVENTS: CalendarEvent[] = [
  { id: 1, day: 2, time: '10:00', title: 'Weekly planning', type: 'personal:meeting', end: '11:00' },
  { id: 2, day: 3, time: '14:30', title: 'Draft API notes', type: 'personal:note' },
  { id: 3, day: 4, title: 'Docs sprint', type: 'studio:project', allDay: true, until: 6 },
  { id: 4, day: 5, time: '09:00', title: 'Standup', type: 'personal:meeting', end: '09:30' },
  { id: 5, day: 6, time: '16:00', title: 'Ship weekly digest', type: 'studio:task', done: true },
  { id: 6, day: 9, time: '09:30', title: 'Design review', type: 'personal:meeting', end: '10:15' },
  { id: 7, day: 9, time: '13:00', title: 'Rewrite empty states', type: 'studio:task' },
  { id: 8, day: 10, time: '11:00', title: 'Sync with Mara', type: 'personal:meeting', end: '11:45' },
  { id: 9, day: 10, title: 'Field notes: local-first', type: 'personal:note' },
  { id: 10, day: 11, time: '15:00', title: 'Ship changelog', type: 'studio:task' },
  { id: 11, day: 12, title: 'Launch week', type: 'studio:project', allDay: true, until: 16 },
  { id: 12, day: 12, time: '09:30', title: 'Design review', type: 'personal:meeting', end: '10:15' },
  { id: 13, day: 12, time: '11:00', title: 'Write release notes', type: 'studio:task' },
  { id: 14, day: 12, time: '14:00', title: 'Reply to Iris', type: 'personal:task' },
  { id: 15, day: 13, time: '08:00', title: 'Grid rhythm experiments', type: 'studio:idea' },
  { id: 16, day: 13, time: '17:00', title: 'Close the week', type: 'personal:task' },
  { id: 17, day: 14, title: 'Seeing Like a State', type: 'reading:book', allDay: true, until: 21 },
  { id: 18, day: 16, time: '10:00', title: 'Weekly planning', type: 'personal:meeting', end: '10:30' },
  { id: 19, day: 17, time: '12:00', title: 'Lunch with Iris', type: 'personal:person' },
  { id: 20, day: 18, time: '09:00', title: 'Sync API contract', type: 'studio:task' },
  { id: 21, day: 20, title: 'Quarter close', type: 'studio:project', allDay: true, until: 21 },
  { id: 22, day: 23, time: '11:30', title: 'Interview: Sofia', type: 'personal:meeting', end: '12:15' },
  { id: 23, day: 24, time: '15:00', title: 'Prune stale objects', type: 'studio:task' },
  { id: 24, day: 25, time: '09:00', title: 'Invoice 2026-014 due', type: 'studio:invoice' },
  { id: 25, day: 26, time: '09:30', title: 'Weekly digest draft', type: 'personal:note' },
  { id: 26, day: 27, time: '14:00', title: 'Roadmap pass', type: 'studio:project' },
  { id: 27, day: 30, time: '10:00', title: 'Weekly planning', type: 'personal:meeting', end: '10:30' },
  { id: 28, day: 31, time: '16:00', title: 'Close the month', type: 'personal:task' }
]

export const calendarData: CalendarData = {
  spaces: SPACES,
  types: TYPES,
  events: EVENTS,
  year: 2026,
  month: 2,
  monthLabel: 'March 2026',
  today: 12,
  trackedTypeKeys: [
    'personal:task',
    'personal:meeting',
    'personal:note',
    'personal:person',
    'studio:project',
    'studio:task',
    'studio:invoice',
    'studio:idea',
    'reading:book'
  ],
  trackedSpaceKeys: ['personal', 'studio', 'reading']
}
