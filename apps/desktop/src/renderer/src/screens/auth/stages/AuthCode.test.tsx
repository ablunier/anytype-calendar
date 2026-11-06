import { renderWithI18n } from '@renderer/test/render'
import { act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthCode } from './AuthCode'

function renderAuthCode(expiresAt = Date.now() + 5 * 60_000) {
  const onVerify = vi.fn()
  const onCancel = vi.fn()
  const view = renderWithI18n(
    <AuthCode challengeId="ch_1" expiresAt={expiresAt} onCancel={onCancel} onVerify={onVerify} />,
  )
  const input = screen.getByRole('textbox', { name: '4-digit code from Anytype' })
  const verify = screen.getByRole('button', { name: 'Verify code' })
  return { ...view, onVerify, onCancel, input, verify }
}

/** The four boxes are aria-hidden, drawn after the input that owns the value. */
function digitBox(input: HTMLElement, index: number): HTMLElement {
  return input.nextElementSibling?.children[index] as HTMLElement
}

afterEach(() => {
  vi.useRealTimers()
})

describe('AuthCode', () => {
  it('has a labelled input, focused on mount', () => {
    const { input } = renderAuthCode()
    expect(input).toHaveFocus()
  })

  it('keeps digits only, at most four', async () => {
    const { user, input } = renderAuthCode()
    await user.paste('12-34')
    expect(input).toHaveValue('1234')

    await user.clear(input)
    await user.keyboard('a1b2c3d4 5')
    expect(input).toHaveValue('1234')
  })

  it('verifies only once there are four digits, by the button or Enter', async () => {
    const { user, input, verify, onVerify } = renderAuthCode()
    await user.keyboard('123')
    expect(verify).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(onVerify).not.toHaveBeenCalled()

    await user.keyboard('4')
    expect(verify).toBeEnabled()
    await user.keyboard('{Enter}')
    expect(onVerify).toHaveBeenCalledExactlyOnceWith('1234')

    await user.click(verify)
    expect(onVerify).toHaveBeenLastCalledWith('1234')
    expect(input).toHaveValue('1234')
  })

  it('moves the caret to a digit box clicked', async () => {
    const { user, input } = renderAuthCode()
    await user.keyboard('1234')
    await user.click(digitBox(input, 1))
    expect(input).toHaveFocus()
    expect(input).toHaveProperty('selectionStart', 1)

    // Typing over the selected digit replaces it.
    await user.keyboard('9')
    expect(input).toHaveValue('1934')
  })

  it('moves the caret no further than the digits typed', async () => {
    const { user, input } = renderAuthCode()
    await user.keyboard('12')
    await user.click(digitBox(input, 3))
    expect(input).toHaveProperty('selectionStart', 2)
    expect(input).toHaveProperty('selectionEnd', 2)
  })

  it('counts down, then says the code expired', () => {
    vi.useFakeTimers()
    renderAuthCode(Date.now() + 65_000)
    expect(screen.getByText('expires in 1:05')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText('expires in 0:05')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(5_000))
    expect(screen.getByText('expired')).toBeInTheDocument()
    expect(screen.queryByText(/expires in/)).not.toBeInTheDocument()
  })
})
