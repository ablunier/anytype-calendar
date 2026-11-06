import { buildMonthGrid, isoDate } from '@renderer/lib/calendar'
import { renderWithI18n } from '@renderer/test/render'
import type { CalendarEvent } from '@renderer/types'
import { fireEvent, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MonthGrid } from './MonthGrid'

// November 2026 starts on a Sunday and ends on a Monday, so with Monday first the grid
// borrows six days either side and only days 7 to 25 are numbers no other cell repeats.
const YEAR = 2026
const MONTH = 10

interface HarnessProps {
  events?: CalendarEvent[]
  onCreate?: (date: string) => void
  onOpenEvent?: (event: CalendarEvent) => void
}

function Harness({ events = [], onCreate = () => {}, onOpenEvent = () => {} }: HarnessProps): React.JSX.Element {
  const [focusedDay, setFocusedDay] = useState(10)
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <>
      <button type="button">Before</button>
      <MonthGrid
        cells={buildMonthGrid(YEAR, MONTH, 0)}
        events={events}
        typesByKey={new Map()}
        today={isoDate(YEAR, MONTH, 3)}
        showWeekNumbers={false}
        weekStart={0}
        selectedDate={selected}
        focusedDay={focusedDay}
        onFocusDay={setFocusedDay}
        onSelectDay={(day) => setSelected(isoDate(YEAR, MONTH, day))}
        onOpenEvent={onOpenEvent}
        onCreate={onCreate}
        drag={null}
      />
      <button type="button">After</button>
    </>
  )
}

const STANDUP_ON_11: CalendarEvent = {
  id: 'ev_1',
  title: 'Standup',
  type: 'task',
  space: 'sp_1',
  rank: 0,
  date: isoDate(YEAR, MONTH, 11),
  allDay: true,
  details: [],
}

const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Month' })
const cell = (day: number): HTMLElement => within(grid()).getByRole('gridcell', { name: String(day) })
/** The cells a Tab can land on: the roving tab stop. */
const tabStops = (): HTMLElement[] =>
  within(grid())
    .getAllByRole('gridcell')
    .filter((td) => td.tabIndex === 0)

describe('MonthGrid', () => {
  it('is a table whose columns are named by weekday', () => {
    renderWithI18n(<Harness />)
    expect(grid().tagName).toBe('TABLE')
    const headers = within(grid()).getAllByRole('columnheader')
    expect(headers.map((header) => header.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('has a single tab stop, on the focused day', async () => {
    const { user } = renderWithI18n(<Harness />)
    expect(tabStops()).toEqual([cell(10)])
    await user.click(screen.getByRole('button', { name: 'Before' }))
    await user.tab()
    expect(cell(10)).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
  })

  it('moves the tab stop and focus with the arrow keys', async () => {
    const { user } = renderWithI18n(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Before' }))
    await user.tab()

    await user.keyboard('{ArrowRight}')
    expect(cell(11)).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(cell(18)).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(cell(17)).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(cell(10)).toHaveFocus()
    expect(tabStops()).toEqual([cell(10)])
  })

  it('jumps to the first and last day of the month with Home and End', async () => {
    const { user } = renderWithI18n(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Before' }))
    await user.tab()

    await user.keyboard('{End}')
    expect(tabStops()).toHaveLength(1)
    expect(tabStops()[0]).toHaveFocus()
    expect(tabStops()[0]).toHaveTextContent(/^30$/)

    await user.keyboard('{Home}')
    expect(tabStops()[0]).toHaveFocus()
    expect(tabStops()[0]).toHaveTextContent(/^1$/)
  })

  it('selects the focused day with Enter and with Space', async () => {
    const { user } = renderWithI18n(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Before' }))
    await user.tab()
    expect(cell(10)).toHaveAttribute('aria-selected', 'false')

    await user.keyboard('{Enter}')
    expect(cell(10)).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowRight} ')
    expect(cell(11)).toHaveAttribute('aria-selected', 'true')
    expect(cell(10)).toHaveAttribute('aria-selected', 'false')
  })

  it('creates on the day of the first press, though the second lands on the next', () => {
    const onCreate = vi.fn()
    renderWithI18n(<Harness onCreate={onCreate} />)
    fireEvent.click(cell(10), { detail: 1 })
    // A pressed mouse button moves focus unless its default is prevented.
    expect(fireEvent.mouseDown(cell(11), { detail: 2 })).toBe(false)
    fireEvent.click(cell(11), { detail: 2 })
    fireEvent.dblClick(cell(11), { detail: 2 })
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(isoDate(YEAR, MONTH, 10))
    // The second press selects nothing, so the day created on stays the one selected.
    expect(cell(10)).toHaveAttribute('aria-selected', 'true')
    expect(cell(11)).toHaveAttribute('aria-selected', 'false')
  })

  it('creates on the day of the first press, though the second lands on an object', () => {
    const onCreate = vi.fn()
    const onOpenEvent = vi.fn()
    renderWithI18n(<Harness events={[STANDUP_ON_11]} onCreate={onCreate} onOpenEvent={onOpenEvent} />)
    const chip = screen.getByRole('button', { name: /Standup/ })
    fireEvent.click(cell(10), { detail: 1 })
    fireEvent.click(chip, { detail: 2 })
    fireEvent.dblClick(chip, { detail: 2 })
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(isoDate(YEAR, MONTH, 10))
    expect(onOpenEvent).not.toHaveBeenCalled()
  })

  it('opens an object double-clicked from its first press, and creates nothing', () => {
    const onCreate = vi.fn()
    const onOpenEvent = vi.fn()
    renderWithI18n(<Harness events={[STANDUP_ON_11]} onCreate={onCreate} onOpenEvent={onOpenEvent} />)
    fireEvent.click(cell(10), { detail: 1 })
    const chip = screen.getByRole('button', { name: /Standup/ })
    fireEvent.click(chip, { detail: 1 })
    fireEvent.click(chip, { detail: 2 })
    fireEvent.dblClick(chip, { detail: 2 })
    expect(onOpenEvent).toHaveBeenCalledTimes(2)
    expect(onCreate).not.toHaveBeenCalled()
  })
})
