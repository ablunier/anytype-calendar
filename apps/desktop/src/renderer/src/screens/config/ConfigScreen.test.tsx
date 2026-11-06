import { objectType } from '@renderer/test/fixtures'
import { renderWithI18n } from '@renderer/test/render'
import type { TypePicks } from '@renderer/types'
import { screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfigScreen, type ConfigScreenProps } from './ConfigScreen'

const task = objectType('work', 'task', 'Task', {
  props: [
    { key: 'start_date', label: 'Start date' },
    { key: 'end_date', label: 'End date' },
    { key: 'due_date', label: 'Due date' },
  ],
})
const work = { key: 'work', name: 'Work' }

const LAST_CHANGE_FAILED = 'Your last change could not be saved.'

function configProps(overrides: Partial<ConfigScreenProps> = {}): ConfigScreenProps {
  return {
    spaces: [work],
    types: [task],
    sync: { state: 'synced', hasResult: true },
    hasNotGrantedSpaces: false,
    initial: { spaceKeys: ['work'], typeKeys: [], dates: {} },
    apiKey: { hint: 'ab12', issuedAt: Date.UTC(2026, 10, 1) },
    access: null,
    language: 'en',
    onLanguage: vi.fn(),
    showWeekNumbers: false,
    onShowWeekNumbers: vi.fn(),
    weekStart: 0,
    onWeekStart: vi.fn(),
    calendarView: 'month',
    onCalendarView: vi.fn(),
    timeFormat: '24h',
    onTimeFormat: vi.fn(),
    onBack: vi.fn(),
    onReread: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onCopyKey: vi.fn().mockResolvedValue(true),
    onSignOut: vi.fn(),
    appVersion: '1.0.0',
    updateAvailable: null,
    onOpenRelease: vi.fn(),
    feeds: [],
    feedActions: {
      onAdd: vi.fn(),
      onEdit: vi.fn(),
      onRemove: vi.fn(),
      onReorder: vi.fn(),
      onRefresh: vi.fn(),
    },
    ...overrides,
  }
}

const taskCheckbox = (): HTMLElement => screen.getByRole('checkbox', { name: 'Show Task objects on the calendar' })

describe('ConfigScreen saving', () => {
  it('saves every pick on each change to the spaces and types', async () => {
    const props = configProps()
    const { user } = renderWithI18n(<ConfigScreen {...props} />)

    await user.click(taskCheckbox())
    expect(props.onSave).toHaveBeenLastCalledWith({ spaceKeys: ['work'], typeKeys: [task.key], dates: {} })

    await user.click(screen.getByRole('checkbox', { name: 'Work' }))
    expect(props.onSave).toHaveBeenLastCalledWith({ spaceKeys: [], typeKeys: [task.key], dates: {} })
    expect(props.onSave).toHaveBeenCalledTimes(2)
  })

  it('saves nothing on mount, even under StrictMode', () => {
    const props = configProps()
    renderWithI18n(
      <StrictMode>
        <ConfigScreen {...props} />
      </StrictMode>,
    )
    expect(taskCheckbox()).not.toBeChecked()
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('says the last change failed until a later save lands', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined)
    const { user } = renderWithI18n(<ConfigScreen {...configProps({ onSave })} />)

    await user.click(taskCheckbox())
    expect(await screen.findByText(LAST_CHANGE_FAILED)).toBeInTheDocument()

    await user.click(taskCheckbox())
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(LAST_CHANGE_FAILED)).not.toBeInTheDocument()
  })
})

describe('ConfigScreen first read', () => {
  it('starts the picks from the saved selection over the read types', async () => {
    // Before the read, App has no types to read the saved dates over, so it hands on none.
    const unread: TypePicks = { spaceKeys: ['work'], typeKeys: [task.key], dates: {} }
    const saved: TypePicks = {
      ...unread,
      dates: {
        [task.key]: {
          from: 'due_date',
          to: null,
          includesTime: false,
          colourBy: null,
          panel: [],
          done: null,
          location: null,
          view: null,
        },
      },
    }
    const props = configProps({ types: [], initial: unread, sync: { state: 'syncing', hasResult: false } })
    const { user, rerender } = renderWithI18n(<ConfigScreen {...props} />)
    expect(screen.getByText('Reading your spaces…')).toBeInTheDocument()

    rerender(<ConfigScreen {...props} types={[task]} initial={saved} sync={{ state: 'synced', hasResult: true }} />)
    expect(taskCheckbox()).toBeChecked()
    expect(screen.getByText('Due date · all day')).toBeInTheDocument()
    expect(props.onSave).not.toHaveBeenCalled()

    await user.click(screen.getByRole('checkbox', { name: 'Work' }))
    expect(props.onSave).toHaveBeenCalledWith({ ...saved, spaceKeys: [] })
  })
})

describe('ConfigScreen sync errors', () => {
  it('offers to read the spaces again', async () => {
    const props = configProps({
      types: [],
      sync: { state: 'error', detail: { kind: 'unreachable' }, hasResult: false },
    })
    const { user } = renderWithI18n(<ConfigScreen {...props} />)
    expect(screen.getByText('Read your spaces again')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Work' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.onReread).toHaveBeenCalledOnce()
  })
})
