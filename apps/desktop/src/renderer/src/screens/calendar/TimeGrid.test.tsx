import { buildWeek } from '@renderer/lib/calendar'
import { renderWithI18n } from '@renderer/test/render'
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TimeGrid } from './TimeGrid'

function renderTimeGrid(days: ReturnType<typeof buildWeek>) {
  return renderWithI18n(
    <TimeGrid
      days={days}
      events={[]}
      typesByKey={new Map()}
      today="2026-11-11"
      nowMinute={600}
      weekStart={0}
      selectedDate={null}
      onSelectDay={() => {}}
      onOpenEvent={() => {}}
      onCreate={() => {}}
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
})
