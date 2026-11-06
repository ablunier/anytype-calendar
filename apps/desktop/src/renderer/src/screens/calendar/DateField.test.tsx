import { Dialog } from '@renderer/components/ui'
import { renderWithI18n } from '@renderer/test/render'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateField } from './DateField'

function renderDateField({ inDialog = false }: { inDialog?: boolean } = {}) {
  const onChange = vi.fn()
  const onClose = vi.fn()
  const field = (
    <DateField
      value="2026-11-10"
      label="Due date"
      today="2026-11-06"
      weekStart={1}
      showWeekNumbers={false}
      onChange={onChange}
    />
  )
  const view = renderWithI18n(
    <>
      {inDialog ? (
        <Dialog open title="Edit" onClose={onClose}>
          {field}
        </Dialog>
      ) : (
        field
      )}
      <button type="button">Elsewhere</button>
    </>,
  )
  const button = screen.getByRole('button', { name: 'Due date: November 10, 2026' })
  return { ...view, onChange, onClose, button }
}

describe('DateField', () => {
  it('is a button named by its label and the long date, which reports whether its picker is open', async () => {
    const { user, button } = renderDateField()
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog', { name: 'Due date' })).not.toBeInTheDocument()

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Due date' })).toBeInTheDocument()

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on picking another day, gives focus back to the button and reports the day', async () => {
    const { user, button, onChange } = renderDateField()
    await user.click(button)
    const picker = screen.getByRole('dialog', { name: 'Due date' })
    await user.click(within(picker).getByRole('button', { name: 'November 20, 2026' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-11-20')
    expect(screen.queryByRole('dialog', { name: 'Due date' })).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('closes without reporting on picking the day it already has', async () => {
    const { user, button, onChange } = renderDateField()
    await user.click(button)
    const picker = screen.getByRole('dialog', { name: 'Due date' })
    await user.click(within(picker).getByRole('button', { name: 'November 10, 2026' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Due date' })).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('closes on Escape and gives focus back to the button, leaving the dialog around it open', async () => {
    const { user, button, onChange, onClose } = renderDateField({ inDialog: true })
    await user.click(button)
    const picker = screen.getByRole('dialog', { name: 'Due date' })
    await user.click(within(picker).getByRole('button', { name: 'Next month' }))

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Due date' })).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(onClose).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes on a press outside it', async () => {
    const { user, button, onChange } = renderDateField()
    await user.click(button)
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))

    expect(screen.queryByRole('dialog', { name: 'Due date' })).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(onChange).not.toHaveBeenCalled()
  })
})
