import { renderWithI18n } from '@renderer/test/render'
import type { CalendarSlot, Collection, ObjectType, Space } from '@renderer/types'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateEventDialog } from './CreateEventDialog'

const work: Space = { key: 'work', name: 'Work' }
const home: Space = { key: 'home', name: 'Home' }
const side: Space = { key: 'side', name: 'Side' }

function objectType(key: string, label: string, space: Space, includesTime = false): ObjectType {
  return {
    key,
    space: space.key,
    label,
    category: 'sage',
    icon: 'calendar',
    props: [],
    selects: [],
    checkboxes: [],
    texts: [],
    panelProps: [],
    from: 'dueDate',
    to: null,
    includesTime,
    colourBy: null,
    panel: [],
    done: null,
    location: null,
  }
}

function collection(key: string, name: string): Collection {
  return { key, name, lastModified: null, backlinks: [] }
}

const task = objectType('task', 'Task', work)
const meeting = objectType('meeting', 'Meeting', work, true)
const chore = objectType('chore', 'Chore', home)
const idea = objectType('idea', 'Idea', side)

const collectionsBySpace = new Map([
  [work.key, [collection('projects', 'Projects'), collection('archive', 'Archive')]],
  [home.key, [collection('errands', 'Errands')]],
])

function renderDialog({
  types = [task, meeting, chore, idea],
  slot = { date: '2026-11-10', minute: null },
  created = true,
}: {
  types?: ObjectType[]
  slot?: CalendarSlot
  created?: boolean
} = {}) {
  const onCreate = vi.fn(async () => created)
  const onClose = vi.fn()
  const view = renderWithI18n(
    <CreateEventDialog
      slot={slot}
      types={types}
      spacesByKey={new Map([work, home, side].map((space) => [space.key, space]))}
      collectionsBySpace={collectionsBySpace}
      onClose={onClose}
      onCreate={onCreate}
    />,
  )
  const dialog = screen.getByRole('dialog', { name: 'New object' })
  return { ...view, onCreate, onClose, dialog }
}

const nameField = () => screen.getByRole('textbox', { name: 'Name' })
const typeField = () => screen.getByRole('combobox', { name: 'Type' })
const collectionField = () => screen.queryByRole('combobox', { name: 'Collection' })
const createButton = () => screen.getByRole('button', { name: 'Create' })

describe('CreateEventDialog', () => {
  it('describes the slot by its long date', () => {
    const { dialog } = renderDialog()
    expect(dialog).toHaveAccessibleDescription('November 10, 2026')
  })

  it('creates an all-day object with the trimmed name, the type, the date and no collection, then closes', async () => {
    const { user, onCreate, onClose } = renderDialog({ slot: { date: '2026-11-10', minute: 600 } })
    await user.type(nameField(), '  Plan the trip  ')
    await user.click(createButton())

    expect(onCreate).toHaveBeenCalledExactlyOnceWith(task, 'Plan the trip', { date: '2026-11-10', minute: null }, null)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('starts a timed type at the slot’s minute', async () => {
    const { user, onCreate } = renderDialog({ slot: { date: '2026-11-10', minute: 14 * 60 + 30 } })
    await user.selectOptions(typeField(), 'Meeting · Work')
    expect(screen.getByLabelText('Time')).toHaveValue('14:30')

    await user.click(createButton())
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(meeting, '', { date: '2026-11-10', minute: 14 * 60 + 30 }, null)
  })

  it('starts a timed type at 9:00 when the slot has no time', async () => {
    const { user, onCreate } = renderDialog()
    await user.selectOptions(typeField(), 'Meeting · Work')
    expect(screen.getByLabelText('Time')).toHaveValue('09:00')

    await user.click(createButton())
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(meeting, '', { date: '2026-11-10', minute: 9 * 60 }, null)
  })

  it('asks for a time only for a type that has one', async () => {
    const { user } = renderDialog()
    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument()
    await user.selectOptions(typeField(), 'Meeting · Work')
    expect(screen.getByLabelText('Time')).toBeInTheDocument()
  })

  it('stays open, as filled in, when the object is not created', async () => {
    const { user, onCreate, onClose, dialog } = renderDialog({ created: false })
    await user.type(nameField(), 'Plan the trip')
    await user.selectOptions(typeField(), 'Meeting · Work')
    await user.click(createButton())

    expect(onCreate).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    expect(dialog).toBeInTheDocument()
    expect(nameField()).toHaveValue('Plan the trip')
    expect(typeField()).toHaveDisplayValue('Meeting · Work')
    expect(createButton()).toBeEnabled()
  })

  it('creates in the collection picked', async () => {
    const { user, onCreate } = renderDialog()
    const field = collectionField() as HTMLElement
    await user.click(field)
    await user.click(
      within(screen.getByRole('listbox', { name: 'Collection' })).getByRole('option', { name: 'Projects' }),
    )
    expect(field).toHaveValue('Projects')

    await user.click(createButton())
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(task, '', { date: '2026-11-10', minute: null }, 'projects')
  })

  it('offers a collection only where the type’s space has some', async () => {
    const { user } = renderDialog()
    expect(collectionField()).toBeInTheDocument()
    await user.selectOptions(typeField(), 'Idea · Side')
    expect(collectionField()).not.toBeInTheDocument()
  })

  it('keeps the collection for a type in the same space, and puts it back to None for one in another', async () => {
    const { user, onCreate } = renderDialog()
    await user.click(collectionField() as HTMLElement)
    await user.click(screen.getByRole('option', { name: 'Projects' }))

    await user.selectOptions(typeField(), 'Meeting · Work')
    expect(collectionField()).toHaveValue('Projects')

    await user.selectOptions(typeField(), 'Chore · Home')
    expect(collectionField()).toHaveValue('None')

    await user.click(createButton())
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(chore, '', { date: '2026-11-10', minute: null }, null)
  })

  it('names each type’s space when the types span more than one', () => {
    renderDialog()
    const labels = within(typeField())
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(labels).toEqual(['Task · Work', 'Meeting · Work', 'Chore · Home', 'Idea · Side'])
  })

  it('names types alone when they are all in one space', () => {
    renderDialog({ types: [task, meeting] })
    const labels = within(typeField())
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(labels).toEqual(['Task', 'Meeting'])
  })
})
