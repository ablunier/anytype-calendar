import { buildMonthGrid, isoDate } from '@renderer/lib/calendar'
import { renderWithI18n } from '@renderer/test/render'
import { screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { MonthGrid } from './MonthGrid'

// November 2026 starts on a Sunday and ends on a Monday, so with Monday first the grid
// borrows six days either side and only days 7 to 25 are numbers no other cell repeats.
const YEAR = 2026
const MONTH = 10

function Harness(): React.JSX.Element {
  const [focusedDay, setFocusedDay] = useState(10)
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <>
      <button type="button">Before</button>
      <MonthGrid
        cells={buildMonthGrid(YEAR, MONTH, 0)}
        events={[]}
        typesByKey={new Map()}
        today={isoDate(YEAR, MONTH, 3)}
        showWeekNumbers={false}
        weekStart={0}
        selectedDate={selected}
        focusedDay={focusedDay}
        onFocusDay={setFocusedDay}
        onSelectDay={(day) => setSelected(isoDate(YEAR, MONTH, day))}
        onOpenEvent={() => {}}
        onCreate={() => {}}
        drag={null}
      />
      <button type="button">After</button>
    </>
  )
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
})
