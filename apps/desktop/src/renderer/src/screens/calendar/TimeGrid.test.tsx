import { buildWeek } from '@renderer/lib/calendar'
import { renderWithI18n } from '@renderer/test/render'
import type { CalendarSlot } from '@renderer/types'
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimeGrid } from './TimeGrid'

function renderTimeGrid(
  days: ReturnType<typeof buildWeek>,
  onCreate: (slot: CalendarSlot) => void = () => {},
  onSelectDay: (date: string) => void = () => {},
) {
  return renderWithI18n(
    <TimeGrid
      days={days}
      events={[]}
      typesByKey={new Map()}
      today="2026-11-11"
      nowMinute={600}
      weekStart={0}
      selectedDate={null}
      onSelectDay={onSelectDay}
      onOpenEvent={() => {}}
      onCreate={onCreate}
      drag={null}
    />,
  )
}

describe('TimeGrid', () => {
  it('draws a week as a table whose columns are named by the whole date', () => {
    renderTimeGrid(buildWeek('2026-11-11', 0))
    // A table, not a grid: no arrow keys move between its days.
    const table = screen.getByRole('table', { name: 'Week' })
    expect(table.tagName).toBe('TABLE')
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    const headers = within(table).getAllByRole('columnheader')
    expect(headers).toHaveLength(7)
    expect(within(table).getByRole('columnheader', { name: 'Wednesday, November 11, 2026' })).toBeInTheDocument()
  })

  it('draws a day as a table of one column', () => {
    renderTimeGrid([{ date: '2026-11-11', outside: false }])
    const table = screen.getByRole('table', { name: 'Day' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(1)
  })

  it('creates at the slot of the first press, though the second lands elsewhere', () => {
    const onCreate = vi.fn()
    const onSelectDay = vi.fn()
    const { container } = renderTimeGrid(buildWeek('2026-11-11', 0), onCreate, onSelectDay)
    // The empty day under the objects, one per column; jsdom lays nothing out, so each is given 24 rows of 40px.
    const columns = [...container.querySelectorAll<HTMLElement>('td.day-canvas > div[aria-hidden]:first-child')]
    for (const column of columns) column.getBoundingClientRect = () => ({ top: 0, height: 960 }) as DOMRect
    const [wednesday, thursday] = [columns[2], columns[3]]
    // The first press selects the day, which opens the panel and narrows the grid under the pointer.
    fireEvent.click(wednesday, { detail: 1, clientY: 400 })
    fireEvent.click(thursday, { detail: 2, clientY: 440 })
    fireEvent.dblClick(thursday, { detail: 2, clientY: 440 })
    expect(onCreate).toHaveBeenCalledExactlyOnceWith({ date: '2026-11-11', minute: 600 })
    // The second press selects nothing, so the day created on stays the one selected.
    expect(onSelectDay).toHaveBeenCalledExactlyOnceWith('2026-11-11')
  })

  it('creates where it is double-clicked when no press came before', () => {
    const onCreate = vi.fn()
    const { container } = renderTimeGrid(buildWeek('2026-11-11', 0), onCreate)
    const thursday = container.querySelectorAll<HTMLElement>('td.day-canvas > div[aria-hidden]:first-child')[3]
    thursday.getBoundingClientRect = () => ({ top: 0, height: 960 }) as DOMRect
    fireEvent.dblClick(thursday, { detail: 2, clientY: 440 })
    expect(onCreate).toHaveBeenCalledExactlyOnceWith({ date: '2026-11-12', minute: 660 })
  })
})
