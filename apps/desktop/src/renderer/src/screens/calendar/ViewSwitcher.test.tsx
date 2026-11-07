import { renderWithI18n } from '@renderer/test/render'
import type { CalendarView } from '@renderer/types'
import { screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ViewSwitcher } from './ViewSwitcher'

function Harness({ onChange }: { onChange: (view: CalendarView) => void }): React.JSX.Element {
  const [view, setView] = useState<CalendarView>('week')
  return (
    <>
      <button type="button">Before</button>
      <ViewSwitcher
        view={view}
        onChange={(next) => {
          setView(next)
          onChange(next)
        }}
      />
      <button type="button">After</button>
    </>
  )
}

describe('ViewSwitcher', () => {
  it('is a named radio group with the current view checked', () => {
    renderWithI18n(<Harness onChange={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: 'Calendar view' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Week' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Day' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Month' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Agenda' })).not.toBeChecked()
  })

  it('is one tab stop, on the checked view', async () => {
    const { user } = renderWithI18n(<Harness onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Before' }))
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
  })

  it('moves between views with the arrow keys', async () => {
    const onChange = vi.fn()
    const { user } = renderWithI18n(<Harness onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Before' }))
    await user.tab()

    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('month')
    expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Month' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('agenda')

    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('day')
    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked()
  })
})
