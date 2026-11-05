import { renderWithI18n } from '@renderer/test/render'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

function renderDialog() {
  const onClose = vi.fn()
  const view = renderWithI18n(
    <Dialog open title="Rename" onClose={onClose}>
      <input aria-label="Name" />
    </Dialog>,
  )
  const sheet = screen.getByRole('dialog', { name: 'Rename' })
  // The backdrop is aria-hidden and has no role; it is the sheet's sibling, layered under it.
  const backdrop = sheet.previousElementSibling as HTMLElement
  return { ...view, onClose, sheet, backdrop }
}

describe('Dialog', () => {
  it('closes on Escape', async () => {
    const { user, onClose } = renderDialog()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on a press and release on the backdrop', async () => {
    const { user, onClose, backdrop } = renderDialog()
    await user.pointer({ keys: '[MouseLeft]', target: backdrop })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('stays open when a press starts inside the sheet and ends on the backdrop', async () => {
    const { user, onClose, sheet, backdrop } = renderDialog()
    await user.pointer([{ keys: '[MouseLeft>]', target: sheet }, { target: backdrop }, { keys: '[/MouseLeft]' }])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stays open on a press inside the sheet', async () => {
    const { user, onClose } = renderDialog()
    await user.click(screen.getByRole('textbox', { name: 'Name' }))
    expect(onClose).not.toHaveBeenCalled()
  })
})
