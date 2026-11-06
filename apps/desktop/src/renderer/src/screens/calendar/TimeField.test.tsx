import { Dialog } from '@renderer/components/ui'
import { TimeFormatContext } from '@renderer/hooks/TimeFormatContext'
import { renderWithI18n } from '@renderer/test/render'
import type { TimeFormatSnapshot } from '@shared/ipc'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimeField } from './TimeField'

function renderTimeField(format: TimeFormatSnapshot) {
  const onCommit = vi.fn()
  const onClose = vi.fn()
  const view = renderWithI18n(
    <TimeFormatContext.Provider value={format}>
      <Dialog open title="Edit" onClose={onClose}>
        <TimeField value="09:30" label="Start time" onCommit={onCommit} />
        <button type="button">Elsewhere</button>
      </Dialog>
    </TimeFormatContext.Provider>,
  )
  const field = screen.getByRole('textbox', { name: 'Start time' })
  return { ...view, onCommit, onClose, field }
}

describe.each([
  { format: '24h' as const, shown: '09:30', typed: '14:45', same: '9:30' },
  { format: '12h' as const, shown: '9:30 AM', typed: '2:45 pm', same: '09:30' },
])('TimeField in the $format format', ({ format, shown, typed, same }) => {
  it('shows the saved time', () => {
    const { field } = renderTimeField(format)
    expect(field).toHaveValue(shown)
  })

  it('commits a new time on blur', async () => {
    const { user, field, onCommit } = renderTimeField(format)
    await user.click(field)
    await user.clear(field)
    await user.type(field, typed)
    expect(onCommit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('14:45')
  })

  it('commits a new time on Enter', async () => {
    const { user, field, onCommit } = renderTimeField(format)
    await user.click(field)
    await user.clear(field)
    await user.type(field, `${typed}{Enter}`)
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('14:45')
    expect(field).not.toHaveFocus()
  })

  it('does not commit the time it already has, however it is typed', async () => {
    const { user, field, onCommit } = renderTimeField(format)
    await user.click(field)
    await user.clear(field)
    await user.type(field, `${same}{Enter}`)
    expect(onCommit).not.toHaveBeenCalled()
    expect(field).toHaveValue(shown)
  })

  it('puts the saved time back on Escape without committing or closing the dialog around it', async () => {
    const { user, field, onCommit, onClose } = renderTimeField(format)
    await user.click(field)
    await user.clear(field)
    await user.type(field, `${typed}{Escape}`)
    expect(field).toHaveValue(shown)
    expect(field).not.toHaveFocus()
    expect(onCommit).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('puts the saved time back for what it cannot read', async () => {
    const { user, field, onCommit } = renderTimeField(format)
    await user.click(field)
    await user.clear(field)
    await user.type(field, 'soon{Enter}')
    expect(field).toHaveValue(shown)
    expect(onCommit).not.toHaveBeenCalled()
  })
})
