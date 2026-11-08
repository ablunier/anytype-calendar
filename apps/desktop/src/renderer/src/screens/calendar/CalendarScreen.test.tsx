import en from '@renderer/i18n/locales/en.json'
import { objectType } from '@renderer/test/fixtures'
import { renderWithI18n } from '@renderer/test/render'
import type { CalendarEvent } from '@renderer/types'
import type { EventsEditResult } from '@shared/ipc'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarScreen, type CalendarScreenProps } from './CalendarScreen'

const edit = en.calendar.edit

const task = objectType('work', 'task', 'Task')
const note = objectType('work', 'note', 'Note')

const report: CalendarEvent = {
  id: 'obj-report',
  title: 'Write the report',
  type: task.key,
  space: 'work',
  rank: 0,
  date: '2026-11-11',
  until: '2026-11-12',
  allDay: true,
  done: false,
  details: [],
}

const minutes: CalendarEvent = {
  id: 'obj-minutes',
  title: 'Read the minutes',
  type: note.key,
  space: 'work',
  rank: 1,
  date: '2026-11-05',
  allDay: true,
  details: [],
}

const edited = (result: EventsEditResult) => vi.fn().mockResolvedValue(result)

function renderCalendar(overrides: Partial<CalendarScreenProps> = {}) {
  const props: CalendarScreenProps = {
    span: { kind: 'month', year: 2026, month: 10 },
    events: [report, minutes],
    status: { state: 'synced', hasResult: true },
    types: [task, note],
    spaces: [{ key: 'work', name: 'Work' }],
    trackedSpaceKeys: ['work'],
    sources: [task, note],
    feeds: [],
    hiddenSources: new Set(),
    sidebarCollapsed: false,
    collapsedSpaces: new Set(),
    tracksAnything: true,
    today: '2026-11-03',
    nowMinute: 600,
    theme: 'light',
    showWeekNumbers: false,
    weekStart: 0,
    editAccess: 'editable',
    creatableTypes: [task, note],
    collectionsBySpace: new Map(),
    onReschedule: edited({ ok: true }),
    onCreate: edited({ ok: true }),
    onSetDone: edited({ ok: true }),
    onSetSourcesShown: vi.fn(),
    onToggleSidebar: vi.fn(),
    onToggleSpaceCollapsed: vi.fn(),
    onSelectDate: vi.fn(),
    onToggleTheme: vi.fn(),
    onOpenSettings: vi.fn(),
    onAddCalendar: vi.fn(),
    onView: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
    onReread: vi.fn(),
    updateNotice: null,
    onOpenRelease: vi.fn(),
    onDismissUpdate: vi.fn(),
    ...overrides,
  }
  const view = renderWithI18n(<CalendarScreen {...props} />)
  const update = (changes: Partial<CalendarScreenProps>): void =>
    view.rerender(<CalendarScreen {...props} {...changes} />)
  return { ...view, props, update }
}

const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Month' })
// A cell is named by its day number and then by the objects in it.
const day = (n: number): HTMLElement => within(grid()).getByRole('gridcell', { name: new RegExp(`^${n}\\b`) })
const eventPanel = (): HTMLElement | null => screen.queryByRole('complementary', { name: 'Event detail' })
const createDialog = (): HTMLElement | null => screen.queryByRole('dialog', { name: 'New object' })

async function createOn(user: ReturnType<typeof renderCalendar>['user'], n: number): Promise<void> {
  await user.dblClick(day(n))
  await user.type(within(createDialog() as HTMLElement).getByRole('textbox', { name: 'Name' }), 'Plan the trip')
  await user.click(screen.getByRole('button', { name: 'Create' }))
}

describe('CalendarScreen edit results', () => {
  it('says why in a toast when a create fails, and keeps the dialog open', async () => {
    const { user } = renderCalendar({ onCreate: edited({ ok: false, failure: 'not-granted' }) })
    await createOn(user, 20)
    expect(await screen.findByRole('alert')).toHaveTextContent(edit.failure.notGranted)
    expect(createDialog()).toBeInTheDocument()
  })

  it('says why in a toast when a change of dates fails', async () => {
    const { user, props } = renderCalendar({
      onReschedule: edited({ ok: false, failure: 'rejected', message: 'The object is locked.' }),
    })
    await user.click(screen.getByRole('button', { name: 'Write the report' }))
    await user.click(screen.getByRole('button', { name: 'Remove end date' }))
    expect(props.onReschedule).toHaveBeenCalledWith(expect.objectContaining({ id: report.id }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Anytype refused the change: The object is locked.')
  })

  it('reads a rejected edit as Anytype being unreachable', async () => {
    const { user, props } = renderCalendar({ onSetDone: vi.fn().mockRejectedValue(new Error('IPC failed')) })
    await user.click(screen.getByRole('button', { name: 'Write the report' }))
    await user.click(screen.getByRole('switch', { name: 'Done' }))
    expect(props.onSetDone).toHaveBeenCalledWith({ spaceId: 'work', id: report.id, done: true })
    expect(await screen.findByRole('alert')).toHaveTextContent(edit.failure.unreachable)
  })

  it('says so when a created object could not be added to its collection', async () => {
    const { user } = renderCalendar({ onCreate: edited({ ok: true, collection: { failure: 'gone' } }) })
    await createOn(user, 20)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      `Created, but not added to the collection. ${edit.failure.gone}`,
    )
    expect(createDialog()).not.toBeInTheDocument()
  })

  it('shows no toast when an edit lands', async () => {
    const { user, props } = renderCalendar()
    await createOn(user, 20)
    expect(props.onCreate).toHaveBeenCalledOnce()
    expect(createDialog()).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('CalendarScreen creating', () => {
  it('opens the create dialog on the day double-clicked', async () => {
    const { user, props } = renderCalendar()
    await user.dblClick(day(20))
    expect(createDialog()).toHaveAccessibleDescription('November 20, 2026')
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Plan the trip')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(props.onCreate).toHaveBeenCalledWith({
      spaceId: 'work',
      typeKey: 'task',
      name: 'Plan the trip',
      at: { day: { year: 2026, month: 10, day: 20 }, minute: null },
    })
  })

  it.each([
    ['read-only', edit.readOnly.key],
    ['checking', edit.readOnly.checking],
  ] as const)('when the session is %s, says why instead', async (editAccess, reason) => {
    const { user } = renderCalendar({ editAccess })
    await user.dblClick(day(20))
    expect(screen.getByRole('alert')).toHaveTextContent(reason)
    expect(createDialog()).not.toBeInTheDocument()
  })

  it('with no type to create, says to choose one in Settings', async () => {
    const { user } = renderCalendar({ creatableTypes: [] })
    await user.dblClick(day(20))
    expect(screen.getByRole('alert')).toHaveTextContent(edit.noTypes)
    expect(createDialog()).not.toBeInTheDocument()
  })

  it('with every type to create hidden, says to show one', async () => {
    const { user } = renderCalendar({ creatableTypes: [task], hiddenSources: new Set([task.key]) })
    await user.dblClick(day(20))
    expect(screen.getByRole('alert')).toHaveTextContent(edit.typesHidden)
    expect(createDialog()).not.toBeInTheDocument()
  })
})

describe('CalendarScreen detail panel', () => {
  it('opens the day selected', async () => {
    const { user } = renderCalendar()
    await user.click(day(11))
    expect(day(11)).toHaveAttribute('aria-selected', 'true')
    const panel = screen.getByRole('complementary', { name: 'Day detail' })
    expect(within(panel).getByRole('heading', { name: 'November 11, 2026' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: /Write the report/ })).toBeInTheDocument()
  })

  it('shows the latest copy of the object open, and stays open when it moves out of the span', async () => {
    const { user, update } = renderCalendar()
    await user.click(screen.getByRole('button', { name: 'Write the report' }))
    expect(within(eventPanel() as HTMLElement).getByRole('heading', { name: 'Write the report' })).toBeInTheDocument()

    // Moved into December: drawn so while the write is in flight.
    const moved = { ...report, title: 'Write the final report', date: '2026-12-02', until: '2026-12-03' }
    update({ events: [moved, minutes] })
    const panel = eventPanel() as HTMLElement
    expect(within(panel).getByRole('heading', { name: 'Write the final report' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Go to date' })).toBeInTheDocument()

    // The span read after the write no longer holds it.
    update({ events: [minutes] })
    expect(
      within(eventPanel() as HTMLElement).getByRole('heading', { name: 'Write the final report' }),
    ).toBeInTheDocument()
  })

  it("closes when the object's source is hidden", async () => {
    const { user, update } = renderCalendar()
    await user.click(screen.getByRole('button', { name: 'Write the report' }))
    expect(eventPanel()).toBeInTheDocument()
    update({ hiddenSources: new Set([task.key]) })
    expect(eventPanel()).not.toBeInTheDocument()
  })
})

describe('CalendarScreen changing span', () => {
  const december = { kind: 'month', year: 2026, month: 11 } as const
  // The mini month has arrows of the same name; the navigator's come first.
  const nextButton = (): HTMLElement => screen.getAllByRole('button', { name: 'Next month' })[0] as HTMLElement

  it('keeps focus on Next, so pressing it again moves on again', async () => {
    const { user, props, update } = renderCalendar()
    nextButton().focus()
    await user.keyboard('{Enter}')
    update({ span: december })
    expect(nextButton()).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(props.onNext).toHaveBeenCalledTimes(2)
  })

  it('keeps focus on Next after a key that could not move through the grid', async () => {
    const { user, update } = renderCalendar()
    day(20).focus()
    // The first End reaches the last day; the second has nowhere to go.
    await user.keyboard('{End}{End}')
    nextButton().focus()
    update({ span: december })
    expect(nextButton()).toHaveFocus()
  })

  it('keeps focus in the view switcher, so the arrows keep moving through it', async () => {
    const onView = vi.fn()
    const { user, update } = renderCalendar({ onView })
    await user.click(screen.getByRole('radio', { name: 'Month' }))
    await user.keyboard('{ArrowLeft}')
    expect(onView).toHaveBeenLastCalledWith('week')
    update({ span: { kind: 'week', start: { year: 2026, month: 10, day: 1 } } })
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(onView).toHaveBeenLastCalledWith('day')
  })

  it('starts the new span with no day selected and no panel', async () => {
    const { user, update } = renderCalendar()
    await user.click(day(11))
    expect(screen.getByRole('complementary', { name: 'Day detail' })).toBeInTheDocument()
    update({ span: december, events: [] })
    expect(screen.queryByRole('complementary', { name: 'Day detail' })).not.toBeInTheDocument()
    expect(within(grid()).queryAllByRole('gridcell', { selected: true })).toEqual([])
  })
})

describe('CalendarScreen empty states', () => {
  it('with nothing tracked, points to Settings', async () => {
    const { user, props } = renderCalendar({ tracksAnything: false, events: [] })
    expect(screen.getByText('Choose what goes on the calendar')).toBeInTheDocument()
    expect(screen.queryByRole('grid', { name: 'Month' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Settings' }))
    expect(props.onOpenSettings).toHaveBeenCalledOnce()
  })

  it('with everything hidden, offers to show it all', async () => {
    const { user, props } = renderCalendar({ hiddenSources: new Set([task.key, note.key]) })
    expect(screen.getByText('Everything is hidden')).toBeInTheDocument()
    expect(screen.queryByRole('grid', { name: 'Month' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show all' }))
    expect(props.onSetSourcesShown).toHaveBeenCalledWith([task.key, note.key], true)
  })

  it('with the span not read, says so and offers to read it again', async () => {
    const { user, props } = renderCalendar({
      events: null,
      status: { state: 'error', detail: { kind: 'unreachable' }, hasResult: false },
    })
    expect(screen.getByText("Couldn't read November 2026")).toBeInTheDocument()
    expect(screen.queryByRole('grid', { name: 'Month' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.onReread).toHaveBeenCalledOnce()
  })

  it('with nothing dated in a month nothing can be created in, says so', () => {
    renderCalendar({ events: [], editAccess: 'read-only' })
    expect(screen.getByText('Nothing dated in November 2026')).toBeInTheDocument()
    expect(screen.queryByRole('grid', { name: 'Month' })).not.toBeInTheDocument()
  })
})

describe('CalendarScreen agenda', () => {
  // Today, 3 November, is the agenda's first day; it runs to the 16th.
  const agenda = { kind: 'agenda', start: { year: 2026, month: 10, day: 3 } } as const
  const call: CalendarEvent = {
    id: 'obj-call',
    title: 'Call the bank',
    type: task.key,
    space: 'work',
    rank: 0,
    date: '2026-11-05',
    time: '10:30',
    until: '2026-11-05',
    end: '11:00',
    allDay: false,
    location: 'Office',
    done: false,
    details: [],
  }
  const list = (): HTMLElement => screen.getByRole('list', { name: 'Agenda' })
  const header = (name: RegExp): HTMLElement => within(list()).getByRole('button', { name })

  it('lists today and the days that hold something, in order', () => {
    renderCalendar({ span: agenda, events: [report, minutes, call] })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Nov 3\s*–\s*16, 2026/)
    const days = within(list())
      .getAllByRole('button')
      .filter((button) => button.closest('h2'))
      .map((button) => button.textContent)
    expect(days).toEqual(['TodayTue, Nov 3', 'Thu, Nov 52 events', 'Wed, Nov 111 event', 'Thu, Nov 121 event'])
    expect(screen.getByText('Nothing else today')).toBeInTheDocument()
  })

  it("draws a row's times, type, space, place and day of a range", () => {
    renderCalendar({ span: agenda, events: [report, call] })
    const row = within(list()).getByRole('button', { name: /Call the bank/ })
    expect(row).toHaveTextContent('10:30 – 11:00')
    expect(row).toHaveTextContent('Task · Work')
    expect(row).toHaveTextContent('Office')
    expect(
      within(list())
        .getAllByRole('button', { name: /Write the report/ })
        .map((r) => r.textContent),
    ).toEqual([expect.stringContaining('Day 1 of 2'), expect.stringContaining('Day 2 of 2')])
  })

  it('opens the panel of a row, where ticking it done updates the list', async () => {
    const { user, props, update } = renderCalendar({ span: agenda, events: [call] })
    await user.click(within(list()).getByRole('button', { name: /Call the bank/ }))
    await user.click(within(eventPanel() as HTMLElement).getByRole('switch', { name: 'Done' }))
    expect(props.onSetDone).toHaveBeenCalledWith({ spaceId: 'work', id: call.id, done: true })

    update({ events: [{ ...call, done: true }] })
    expect(within(list()).getByText('Call the bank')).toHaveClass('line-through')
  })

  it("opens a day's panel from its header", async () => {
    const { user } = renderCalendar({ span: agenda, events: [call] })
    await user.click(header(/Thu, Nov 5/))
    const panel = screen.getByRole('complementary', { name: 'Day detail' })
    expect(within(panel).getByRole('heading', { name: 'November 5, 2026' })).toBeInTheDocument()
  })

  it('moves on two weeks from the end of the list', async () => {
    const { user, props } = renderCalendar({ span: agenda, events: [call] })
    // The forward arrow has the same name; this is the one under the list.
    const [, below] = screen.getAllByRole('button', { name: 'Next 2 weeks' })
    await user.click(below as HTMLElement)
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })

  it('with nothing in two weeks that take in today, names them without sending the reader back', () => {
    renderCalendar({ span: { kind: 'agenda', start: { year: 2026, month: 10, day: 1 } }, events: [] })
    expect(screen.getByText(/Nothing in Nov 1\s*–\s*14, 2026/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument()
  })

  it('with nothing in the next two weeks, says so', () => {
    renderCalendar({ span: agenda, events: [] })
    expect(screen.getByText('Nothing in the next 2 weeks')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument()
  })

  it('with nothing in two weeks elsewhere, names them and offers to go back to today', async () => {
    const { user, props } = renderCalendar({
      span: { kind: 'agenda', start: { year: 2026, month: 11, day: 1 } },
      events: [],
    })
    expect(screen.getByText(/Nothing in Dec 1\s*–\s*14, 2026/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(props.onToday).toHaveBeenCalledTimes(1)
  })
})
