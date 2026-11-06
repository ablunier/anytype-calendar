import { renderWithI18n } from '@renderer/test/render'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MiniMonth } from './MiniMonth'

function renderMiniMonth() {
  const onSelectDate = vi.fn()
  const view = renderWithI18n(
    <MiniMonth
      label="Pick a day"
      opensOn="2026-11-10"
      marked={{ first: '2026-11-09', last: '2026-11-15' }}
      today="2026-11-11"
      weekStart={0}
      showWeekNumbers={false}
      min="2026-11-05"
      onSelectDate={onSelectDate}
    />,
  )
  return { ...view, onSelectDate, grid: screen.getByRole('grid', { name: 'November 2026' }) }
}

describe('MiniMonth', () => {
  it('is a table whose columns are named by weekday, though it shows two letters of each', () => {
    const { grid } = renderMiniMonth()
    expect(grid.tagName).toBe('TABLE')
    const wednesday = within(grid).getByRole('columnheader', { name: 'Wed' })
    expect(wednesday).toHaveTextContent(/^We$/)
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7)
  })

  it('marks the chosen days as selected and today as the current date', () => {
    const { grid } = renderMiniMonth()
    const selected = within(grid)
      .getAllByRole('gridcell', { selected: true })
      .map((cell) => within(cell).getByRole('button').textContent)
    expect(selected).toEqual(['9', '10', '11', '12', '13', '14', '15'])
    expect(within(grid).getByRole('button', { name: 'November 11, 2026' })).toHaveAttribute('aria-current', 'date')
  })

  it('picks a day by its button, and not one before the minimum', async () => {
    const { user, grid, onSelectDate } = renderMiniMonth()
    await user.click(within(grid).getByRole('button', { name: 'November 20, 2026' }))
    expect(onSelectDate).toHaveBeenCalledWith('2026-11-20')

    const early = within(grid).getByRole('button', { name: 'November 4, 2026' })
    expect(early).toBeDisabled()
  })

  it('goes back to the month of the day it opens on when that changes, keeping focus', async () => {
    const { user, rerender, onSelectDate } = renderMiniMonth()
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    await user.click(screen.getByRole('button', { name: 'December 2, 2026' }))
    expect(onSelectDate).toHaveBeenCalledWith('2026-12-02')
    rerender(
      <MiniMonth
        label="Pick a day"
        opensOn="2026-12-02"
        marked={{ first: '2026-12-02', last: '2026-12-02' }}
        today="2026-11-11"
        weekStart={0}
        showWeekNumbers={false}
        onSelectDate={onSelectDate}
      />,
    )
    expect(screen.getByRole('grid', { name: 'December 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'December 2, 2026' })).toHaveFocus()
  })

  it('steps to the next month', async () => {
    const { user } = renderMiniMonth()
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('grid', { name: 'December 2026' })).toBeInTheDocument()
  })
})
