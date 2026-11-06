import { renderWithI18n } from '@renderer/test/render'
import { screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox, type CheckboxProps } from './Checkbox'

function Harness({
  onChange,
  ...props
}: Omit<CheckboxProps, 'checked' | 'onChange'> & { onChange: (checked: boolean) => void }): React.JSX.Element {
  const [checked, setChecked] = useState(false)
  return (
    <Checkbox
      {...props}
      checked={checked}
      onChange={(next) => {
        setChecked(next)
        onChange(next)
      }}
    />
  )
}

describe('Checkbox', () => {
  it('is named by its label', () => {
    renderWithI18n(<Harness label="Show weekends" ariaLabel="Ignored" onChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Show weekends' })).not.toBeChecked()
  })

  it('is named by ariaLabel when it has no label', () => {
    renderWithI18n(<Harness ariaLabel="Show weekends" onChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Show weekends' })).toBeInTheDocument()
  })

  it('toggles on a click on its label', async () => {
    const onChange = vi.fn()
    const { user } = renderWithI18n(<Harness label="Show weekends" onChange={onChange} />)
    await user.click(screen.getByText('Show weekends'))
    expect(onChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('checkbox', { name: 'Show weekends' })).toBeChecked()

    await user.click(screen.getByText('Show weekends'))
    expect(onChange).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('checkbox', { name: 'Show weekends' })).not.toBeChecked()
  })

  it('toggles on Space', async () => {
    const onChange = vi.fn()
    const { user } = renderWithI18n(<Harness label="Show weekends" onChange={onChange} />)
    await user.tab()
    expect(screen.getByRole('checkbox', { name: 'Show weekends' })).toHaveFocus()
    await user.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('checkbox', { name: 'Show weekends' })).toBeChecked()
  })

  it('ignores a click and Space when disabled', async () => {
    const onChange = vi.fn()
    const { user } = renderWithI18n(<Harness label="Show weekends" disabled onChange={onChange} />)
    const box = screen.getByRole('checkbox', { name: 'Show weekends' })
    expect(box).toBeDisabled()

    await user.click(screen.getByText('Show weekends'))
    box.focus()
    await user.keyboard(' ')
    expect(onChange).not.toHaveBeenCalled()
    expect(box).not.toBeChecked()
  })
})
