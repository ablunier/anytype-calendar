import { renderWithI18n } from '@renderer/test/render'
import { screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Combobox, type ComboboxOption } from './Combobox'
import { Dialog } from './Dialog'

const none: ComboboxOption = { value: '', label: 'None', pinned: true }
const fruits: ComboboxOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
]

const optionsFor = (query: string): ComboboxOption[] => [
  none,
  ...fruits.filter(({ label }) => label.toLowerCase().includes(query.toLowerCase())),
]

/** In a form in a dialog, so the tests can tell its keys from the form's and the dialog's. */
function Harness({
  onChange,
  onSubmit,
  onClose,
}: {
  onChange: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}): React.JSX.Element {
  const [value, setValue] = useState('banana')
  return (
    <Dialog open title="Pick" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <Combobox
          label="Fruit"
          value={value}
          onChange={(next) => {
            setValue(next)
            onChange(next)
          }}
          optionsFor={optionsFor}
          noMatchText="No fruit matches"
        />
        <button type="submit">Save</button>
      </form>
    </Dialog>
  )
}

function renderCombobox() {
  const onChange = vi.fn()
  const onSubmit = vi.fn()
  const onClose = vi.fn()
  const view = renderWithI18n(<Harness onChange={onChange} onSubmit={onSubmit} onClose={onClose} />)
  const field = screen.getByRole('combobox', { name: 'Fruit' })
  // The dialog puts focus on its first control, its Close button.
  field.focus()
  return { ...view, onChange, onSubmit, onClose, field }
}

/** The option `aria-activedescendant` points at. */
function activeOption(field: HTMLElement): HTMLElement | null {
  const id = field.getAttribute('aria-activedescendant')
  return id ? document.getElementById(id) : null
}

describe('Combobox', () => {
  it('opens on ↓ at the current pick and moves the active option with ↑/↓, focus staying in the field', async () => {
    const { user, field } = renderCombobox()
    expect(field).toHaveFocus()
    expect(field).toHaveValue('Banana')
    expect(field).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{ArrowDown}')
    expect(field).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox', { name: 'Fruit' })).toBeInTheDocument()
    expect(activeOption(field)).toHaveTextContent('Banana')

    await user.keyboard('{ArrowDown}')
    expect(activeOption(field)).toHaveTextContent('Cherry')
    await user.keyboard('{ArrowDown}')
    expect(activeOption(field)).toHaveTextContent('Cherry')

    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(activeOption(field)).toHaveTextContent('None')
    expect(field).toHaveFocus()
  })

  it('opens on ↑ too', async () => {
    const { user, field } = renderCombobox()
    await user.keyboard('{ArrowUp}')
    expect(field).toHaveAttribute('aria-expanded', 'true')
  })

  it('narrows the list as it is typed in, the first match active, and picks it on Enter without submitting', async () => {
    const { user, field, onChange, onSubmit } = renderCombobox()
    await user.keyboard('{ArrowDown}ch')
    const list = screen.getByRole('listbox', { name: 'Fruit' })
    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['None', 'Cherry'])
    expect(activeOption(field)).toHaveTextContent('Cherry')

    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('cherry')
    expect(field).toHaveValue('Cherry')
    expect(field).toHaveAttribute('aria-expanded', 'false')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('lets Enter submit the form while the list is closed', async () => {
    const { user, onSubmit } = renderCombobox()
    await user.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('closes on Escape, keeping the earlier pick, without closing the dialog around it', async () => {
    const { user, field, onChange, onClose } = renderCombobox()
    await user.keyboard('{ArrowDown}app')
    await user.keyboard('{Escape}')
    expect(field).toHaveAttribute('aria-expanded', 'false')
    expect(field).toHaveValue('Banana')
    expect(onChange).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    // Closed, the field lets Escape through to the dialog.
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('leaves on Tab with the pick unchanged', async () => {
    const { user, field, onChange } = renderCombobox()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    await user.tab()
    expect(field).not.toHaveFocus()
    expect(field).toHaveAttribute('aria-expanded', 'false')
    expect(field).toHaveValue('Banana')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('picks an option clicked in the list, which is drawn on the document body', async () => {
    const { user, field, onChange, container } = renderCombobox()
    await user.click(field)
    const list = screen.getByRole('listbox', { name: 'Fruit' })
    expect(container).not.toContainElement(list)

    await user.click(within(list).getByRole('option', { name: 'Apple' }))
    expect(onChange).toHaveBeenLastCalledWith('apple')
    expect(field).toHaveValue('Apple')
    expect(field).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('marks the current pick as selected', async () => {
    const { user, field } = renderCombobox()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'false')
    expect(field).toHaveFocus()
  })

  it('says nothing matches when only the pinned options are left', async () => {
    const { user } = renderCombobox()
    await user.keyboard('{ArrowDown}zz')
    const list = screen.getByRole('listbox', { name: 'Fruit' })
    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['None'])
    expect(list).toHaveTextContent('No fruit matches')
  })

  it('does not say nothing matches while something does', async () => {
    const { user } = renderCombobox()
    await user.keyboard('{ArrowDown}a')
    expect(screen.getByRole('listbox', { name: 'Fruit' })).not.toHaveTextContent('No fruit matches')
  })
})
