import { renderWithI18n } from '@renderer/test/render'
import type { DateMapping, ObjectType } from '@renderer/types'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TypeSettingsDialog } from './TypeSettingsDialog'

const task: ObjectType = {
  key: 'task',
  space: 'work',
  label: 'Task',
  category: 'sage',
  icon: 'calendar',
  props: [
    { key: 'dueDate', label: 'Due date' },
    { key: 'startDate', label: 'Start date' },
    { key: 'endDate', label: 'End date' },
  ],
  selects: [{ key: 'status', label: 'Status' }],
  checkboxes: [{ key: 'doneFlag', label: 'Done flag' }],
  texts: [{ key: 'place', label: 'Place' }],
  panelProps: [],
  from: 'dueDate',
  to: null,
  includesTime: false,
  colourBy: null,
  panel: [],
  done: null,
  location: null,
}

const mapping: DateMapping = {
  from: 'startDate',
  to: 'endDate',
  includesTime: false,
  colourBy: 'status',
  panel: [],
  done: 'doneFlag',
  location: 'place',
  view: null,
}

function renderDialog(type: ObjectType = task) {
  const handlers = {
    onClose: vi.fn(),
    onFromChange: vi.fn(),
    onToChange: vi.fn(),
    onIncludesTimeChange: vi.fn(),
    onColourByChange: vi.fn(),
    onViewChange: vi.fn(),
    onPanelChange: vi.fn(),
    onDoneChange: vi.fn(),
    onLocationChange: vi.fn(),
  }
  const view = renderWithI18n(<TypeSettingsDialog type={type} open mapping={mapping} {...handlers} />)
  return { ...view, ...handlers }
}

const select = (name: string) => screen.getByRole('combobox', { name })
const optionLabels = (name: string) =>
  within(select(name))
    .getAllByRole('option')
    .map((option) => option.textContent)

describe('TypeSettingsDialog', () => {
  it.each([
    { field: 'To date (optional)', none: 'None', handler: 'onToChange' },
    { field: 'Colour', none: 'Type colour', handler: 'onColourByChange' },
    { field: 'Done', none: 'None', handler: 'onDoneChange' },
    { field: 'Location', none: 'None', handler: 'onLocationChange' },
  ] as const)('reports null for $none in $field', async ({ field, none, handler }) => {
    const view = renderDialog()
    await view.user.selectOptions(select(field), none)
    expect(view[handler]).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('reports the property picked', async () => {
    const { user, onToChange, onLocationChange } = renderDialog()
    await user.selectOptions(select('To date (optional)'), 'Due date')
    expect(onToChange).toHaveBeenCalledExactlyOnceWith('dueDate')
    await user.selectOptions(select('Location'), 'None')
    await user.selectOptions(select('Location'), 'Place')
    expect(onLocationChange).toHaveBeenLastCalledWith('place')
  })

  it('leaves the chosen From date out of the To options', () => {
    renderDialog()
    expect(optionLabels('From date')).toEqual(['Due date', 'Start date', 'End date'])
    expect(optionLabels('To date (optional)')).toEqual(['None', 'Due date', 'End date'])
  })

  it('disables Colour, and says why, for a type with no select property', () => {
    renderDialog({ ...task, selects: [] })
    expect(select('Colour')).toBeDisabled()
    expect(screen.getByText('Add a select property to this type in Anytype to colour by it')).toBeInTheDocument()
  })

  it('enables Colour, without the hint, for a type with a select property', () => {
    renderDialog()
    expect(select('Colour')).toBeEnabled()
    expect(optionLabels('Colour')).toEqual(['Type colour', 'Status'])
    expect(screen.queryByText('Add a select property to this type in Anytype to colour by it')).not.toBeInTheDocument()
  })

  it('offers a View only for a query', () => {
    renderDialog()
    expect(screen.queryByRole('combobox', { name: 'View' })).not.toBeInTheDocument()
  })

  it('offers a query’s views, the first until another is picked', async () => {
    const query: ObjectType = {
      ...task,
      key: 'open-tasks',
      label: 'Open tasks',
      query: {
        typeKey: 'task',
        typeLabel: 'Task',
        views: [
          { key: 'all', label: 'All' },
          { key: 'mine', label: 'Mine' },
        ],
      },
    }
    const { user, onViewChange } = renderDialog(query)
    expect(screen.getByRole('dialog', { name: 'Open tasks' })).toHaveAccessibleDescription('Query over Task')
    expect(select('View')).toHaveDisplayValue('All')

    await user.selectOptions(select('View'), 'Mine')
    expect(onViewChange).toHaveBeenCalledExactlyOnceWith('mine')
  })
})
