import { objectType } from '@renderer/test/fixtures'
import { renderWithI18n } from '@renderer/test/render'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OnboardingScreen } from './OnboardingScreen'

const task = objectType('work', 'task', 'Task')
const trip = objectType('home', 'trip', 'Trip')

describe('OnboardingScreen', () => {
  it('hands on the spaces and types picked when continuing', async () => {
    const onContinue = vi.fn()
    const { user } = renderWithI18n(
      <OnboardingScreen
        spaces={[
          { key: 'work', name: 'Work' },
          { key: 'home', name: 'Home' },
        ]}
        types={[task, trip]}
        sync={{ state: 'synced', hasResult: true }}
        hasNotGrantedSpaces={false}
        initial={{ spaceKeys: [], typeKeys: [], dates: {} }}
        onRetrySync={vi.fn()}
        onContinue={onContinue}
        onSkip={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Work' }))
    await user.click(screen.getByRole('checkbox', { name: 'Show Task objects on the calendar' }))
    expect(screen.queryByRole('checkbox', { name: 'Show Trip objects on the calendar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(onContinue).toHaveBeenCalledWith({ spaceKeys: ['work'], typeKeys: [task.key], dates: {} })
  })
})
