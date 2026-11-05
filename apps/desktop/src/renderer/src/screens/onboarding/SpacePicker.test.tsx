import { renderWithI18n } from '@renderer/test/render'
import type { Space } from '@renderer/types'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SpacePicker } from './SpacePicker'

const space: Space = { key: 'work', name: 'Work space' }

describe('SpacePicker', () => {
  it('names the space checkbox by the space and reflects the selection', () => {
    const { rerender } = renderWithI18n(
      <SpacePicker spaces={[space]} types={[]} selectedKeys={[]} onToggle={() => {}} />,
    )
    expect(screen.getByRole('checkbox', { name: 'Work space' })).not.toBeChecked()
    rerender(<SpacePicker spaces={[space]} types={[]} selectedKeys={['work']} onToggle={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Work space' })).toBeChecked()
  })

  it('toggles the space on a click on its name', async () => {
    const onToggle = vi.fn()
    const { user } = renderWithI18n(<SpacePicker spaces={[space]} types={[]} selectedKeys={[]} onToggle={onToggle} />)
    await user.click(screen.getByText('Work space'))
    expect(onToggle).toHaveBeenCalledWith('work')
  })
})
