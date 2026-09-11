import { useState } from 'react'
import type { AuthView, ConnectedScreen } from './types'
import { useNow } from './hooks/useNow'
import { useSchemaSync } from './hooks/useSchemaSync'
import { useSession } from './hooks/useSession'
import { useTheme } from './hooks/useTheme'
import { spacesFor, syncViewFor } from './lib/schema'
import { apiKeyFor, authViewFor } from './lib/session'
import { calendarData, onboardingDefaults } from './mocks'
import { AuthScreen } from './screens/auth/AuthScreen'
import { ConfigScreen } from './screens/config/ConfigScreen'
import { MonthScreen } from './screens/month/MonthScreen'
import { OnboardingScreen } from './screens/onboarding/OnboardingScreen'

/** Often enough for "synced 3 min ago" to stay true. */
const SYNC_AGE_TICK_MS = 30_000

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
  const schema = useSchemaSync()
  const now = useNow(SYNC_AGE_TICK_MS)
  const [screen, setScreen] = useState<ConnectedScreen>('success')

  /* Entering the connected phase picks the first screen. A window that has drawn any other
   * phase watched the sign-in, so it shows the success card; one whose very first snapshot
   * is already connected — a key restored at launch, a reloaded window — goes straight to
   * the calendar. Only the first snapshot counts, never which phase came just before:
   * pushes can land together and be rendered as one, so `verifying` may never be drawn.
   * Adjusted during render rather than in an effect, so no frame of the stale screen is
   * ever drawn. */
  const [phase, setPhase] = useState(session?.phase)
  if (session?.phase !== phase) {
    setPhase(session?.phase)
    if (session?.phase === 'connected') setScreen(phase === undefined ? 'month' : 'success')
  }

  if (!session || !schema) return null

  const authView: AuthView | null =
    authViewFor(session) ?? (screen === 'success' ? { stage: 'success' } : null)
  const apiKey = apiKeyFor(session)

  if (authView) {
    return (
      <AuthScreen
        view={authView}
        spaces={spacesFor(schema)}
        sync={syncViewFor(schema, now)}
        onStart={() => void window.api.auth.start()}
        onSubmitCode={(code) => void window.api.auth.submitCode(code)}
        onStepBack={() => void window.api.auth.stepBack()}
        onRetrySync={() => void window.api.schema.sync()}
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
