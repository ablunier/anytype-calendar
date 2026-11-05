import { FEEDS_COLOURS, nextFeedsColour } from '@anytype-calendar/feeds/domain'
import en from '@renderer/i18n/locales/en.json'
import { renderWithI18n } from '@renderer/test/render'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarsSection } from './CalendarsSection'

function renderSection() {
  const onAdd = vi.fn().mockResolvedValue({ ok: true })
  const view = renderWithI18n(
    <CalendarsSection
      feeds={[]}
      onAdd={onAdd}
      onEdit={vi.fn()}
      onRemove={vi.fn()}
      onReorder={vi.fn()}
      onRefresh={vi.fn()}
    />,
  )
  const swatches = within(screen.getByRole('group', { name: 'Colour' }))
  return { ...view, onAdd, swatches }
}

describe('CalendarsSection colour swatches', () => {
  it('are radios with the next free colour checked', () => {
    const { swatches } = renderSection()
    const radios = swatches.getAllByRole('radio')
    expect(radios).toHaveLength(FEEDS_COLOURS.length)
    expect(radios.filter((radio) => (radio as HTMLInputElement).checked)).toEqual([
      swatches.getByRole('radio', { name: en.feeds.colours[nextFeedsColour([])] }),
    ])
  })

  it('are one tab stop, and the arrow keys move between them', async () => {
    const { user, swatches } = renderSection()
    await user.type(screen.getByRole('textbox', { name: 'iCal address' }), 'https://example.com/a.ics')
    await user.click(screen.getByRole('textbox', { name: 'Name (optional)' }))
    await user.tab()
    const first = nextFeedsColour([])
    expect(swatches.getByRole('radio', { name: en.feeds.colours[first] })).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    const next = FEEDS_COLOURS[(FEEDS_COLOURS.indexOf(first) + 1) % FEEDS_COLOURS.length]
    expect(swatches.getByRole('radio', { name: en.feeds.colours[next] })).toBeChecked()
    expect(swatches.getByRole('radio', { name: en.feeds.colours[next] })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Add calendar' })).toHaveFocus()
  })

  it('do not submit the form on Enter', async () => {
    const { user, onAdd, swatches } = renderSection()
    await user.type(screen.getByRole('textbox', { name: 'iCal address' }), 'https://example.com/a.ics')
    await user.click(swatches.getByRole('radio', { name: en.feeds.colours.teal }))
    await user.keyboard('{Enter}')
    expect(onAdd).not.toHaveBeenCalled()
    expect(swatches.getByRole('radio', { name: en.feeds.colours.teal })).toBeChecked()
  })

  it('leave Enter in the address field submitting the form', async () => {
    const { user, onAdd, swatches } = renderSection()
    await user.click(swatches.getByRole('radio', { name: en.feeds.colours.teal }))
    await user.type(screen.getByRole('textbox', { name: 'iCal address' }), 'https://example.com/a.ics{Enter}')
    expect(onAdd).toHaveBeenCalledWith('https://example.com/a.ics', '', 'teal')
  })
})
