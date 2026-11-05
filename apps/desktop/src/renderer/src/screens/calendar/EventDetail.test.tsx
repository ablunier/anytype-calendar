import { renderWithI18n } from '@renderer/test/render'
import type { CalendarEvent } from '@renderer/types'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventDetail } from './EventDetail'

const event: CalendarEvent = {
  id: 'obj-1',
  title: 'Write the report',
  type: 'task',
  space: 'work',
  rank: 0,
  date: '2026-11-11',
  allDay: true,
  done: true,
  details: [],
}

function renderDetail(readOnlyReason: string | null) {
  const onSetDone = vi.fn()
  const view = renderWithI18n(
    <EventDetail
      event={event}
      type={undefined}
      spacesByKey={new Map()}
      readOnlyReason={readOnlyReason}
      picker={{ today: '2026-11-11', weekStart: 0, showWeekNumbers: false }}
      onSetDone={onSetDone}
      onReschedule={() => {}}
    />,
  )
  return { ...view, onSetDone }
}

describe('EventDetail Done switch', () => {
  it('when read-only, is a tab stop that reports its state and cannot be changed', async () => {
    const { user, onSetDone } = renderDetail('This key can only read.')
    const done = screen.getByRole('switch', { name: 'Done' })
    expect(done).toBeChecked()
    expect(done).toHaveAttribute('aria-readonly', 'true')

    // A read-only panel of this event has two tab stops, the All day switch and then Done.
    document.body.focus()
    await user.tab()
    expect(screen.getByRole('switch', { name: 'All day' })).toHaveFocus()
    await user.tab()
    expect(done).toHaveFocus()

    await user.keyboard(' ')
    await user.click(done)
    expect(onSetDone).not.toHaveBeenCalled()
    expect(done).toBeChecked()
  })

  it('when editable, toggles on a click', async () => {
    const { user, onSetDone } = renderDetail(null)
    const done = screen.getByRole('switch', { name: 'Done' })
    expect(done).toBeChecked()
    await user.click(done)
    expect(onSetDone).toHaveBeenCalledWith(false)
  })
})
