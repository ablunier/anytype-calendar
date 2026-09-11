import { useState } from 'react'
import type { AuthView, ConnectedScreen } from './types'
import { useSession } from './hooks/useSession'
import { useTheme } from './hooks/useTheme'
import { apiKeyFor, authViewFor } from './lib/session'
import { calendarData, onboardingDefaults } from './mocks'
import { AuthScreen } from './screens/auth/AuthScreen'
import { ConfigScreen } from './screens/config/ConfigScreen'
import { MonthScreen } from './screens/month/MonthScreen'
import { OnboardingScreen } from './screens/onboarding/OnboardingScreen'

/**
 * The renderer's root: the screen switcher, the theme, and the only module that reads the
 * mock data.
 *
 * Until the session is connected, what is on screen is derived from the auth session main
 * pushes, and every auth button is an intent sent back over IPC. Once connected, moving
 * between the remaining screens is local state by design — four screens and no URLs, so a
 * router would only add indirection. Everything below here takes what it draws through
 * props.
 */
function App(): React.JSX.Element | null {
  const [theme, toggleTheme] = useTheme()
  const session = useSession()
  const [screen, setScreen] = useState<ConnectedScreen>('success')

  /* Leaving the connected phase resets local navigation, so the next sign-in lands on the
   * success card again. Adjusted during render rather than in an effect, so no frame of
   * the stale screen is ever drawn. */
  const [phase, setPhase] = useState(session?.phase)
  if (session?.phase !== phase) {
    setPhase(session?.phase)
    if (session?.phase !== 'connected') setScreen('success')
  }

  if (!session) return null

  const authView: AuthView | null =
    authViewFor(session) ?? (screen === 'success' ? { stage: 'success' } : null)
  const apiKey = apiKeyFor(session)

  if (authView) {
    return (
      <AuthScreen
        view={authView}
        spaces={calendarData.spaces}
        onStart={() => void window.api.auth.start()}
        onSubmitCode={(code) => void window.api.auth.submitCode(code)}
        onStepBack={() => void window.api.auth.stepBack()}
        onContinue={() => setScreen('onboarding')}
      />
    )
  }

  if (screen === 'onboarding') {
    return (
      <OnboardingScreen
        spaces={calendarData.spaces}
        types={calendarData.types}
        initialTypeKeys={onboardingDefaults.typeKeys}
        initialSpaceKeys={onboardingDefaults.spaceKeys}
        onContinue={() => setScreen('month')}
        onSkip={() => setScreen('month')}
      />
    )
  }

  if (screen === 'config' && apiKey) {
    return (
      <ConfigScreen
        spaces={calendarData.spaces}
        types={calendarData.types}
        initialTypeKeys={calendarData.trackedTypeKeys}
        initialSpaceKeys={calendarData.trackedSpaceKeys}
        apiKey={apiKey}
        onBack={() => setScreen('month')}
        onCopyKey={() => window.api.auth.copyKey()}
        onSignOut={() => void window.api.auth.signOut()}
      />
    )
  }

  return (
    <MonthScreen
      data={calendarData}
      theme={theme}
      onToggleTheme={toggleTheme}
      onOpenSettings={() => setScreen('config')}
    />
  )
}

export default App
