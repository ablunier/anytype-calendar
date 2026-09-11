import { useState } from 'react'
import type { AuthView, ConnectedScreen, DetailTarget } from './types'
import { FlowSwitcher } from './components/app/FlowSwitcher'
import { useSession } from './hooks/useSession'
import { useTheme } from './hooks/useTheme'
import { DETAIL_FRAME_EVENT_ID, FRAMES, frameToState, stateToFrame } from './lib/frames'
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
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [monthDetail, setMonthDetail] = useState<DetailTarget | undefined>(undefined)
  /* Remounts MonthScreen and ConfigScreen when a frame is picked, so their internal state
   * (open panel, open dialog) starts from that frame rather than from wherever the user
   * had left it. */
  const [frameKey, setFrameKey] = useState(0)

  /* Leaving the connected phase resets local navigation, so the next sign-in lands on the
   * success card again. Adjusted during render rather than in an effect, so no frame of
   * the stale screen is ever drawn. */
  const [phase, setPhase] = useState(session?.phase)
  if (session?.phase !== phase) {
    setPhase(session?.phase)
    if (session?.phase !== 'connected') setScreen('success')
  }

  if (!session) return null

  const openFrame = (id: string): void => {
    const next = frameToState(id, Date.now())
    setFrameKey((key) => key + 1)
    setScreen(next.screen)
    setConfirmingRevoke(next.confirmingRevoke)
    setMonthDetail(
      next.showDetail
        ? {
            kind: 'object',
            event: calendarData.events.find((e) => e.id === DETAIL_FRAME_EVENT_ID)!
          }
        : undefined
    )
    void window.api.dev.forceSession(next.session)
  }

  const goToMonth = (): void => {
    setFrameKey((key) => key + 1)
    setMonthDetail(undefined)
    setScreen('month')
  }

  const authView: AuthView | null =
    authViewFor(session) ?? (screen === 'success' ? { stage: 'success' } : null)
  const apiKey = apiKeyFor(session)

  return (
    <>
      {authView ? (
        <AuthScreen
          view={authView}
          spaces={calendarData.spaces}
          onStart={() => void window.api.auth.start()}
          onSubmitCode={(code) => void window.api.auth.submitCode(code)}
          onStepBack={() => void window.api.auth.stepBack()}
          onContinue={() => setScreen('onboarding')}
        />
      ) : null}

      {!authView && screen === 'onboarding' ? (
        <OnboardingScreen
          spaces={calendarData.spaces}
          types={calendarData.types}
          initialTypeKeys={onboardingDefaults.typeKeys}
          initialSpaceKeys={onboardingDefaults.spaceKeys}
          onContinue={goToMonth}
          onSkip={goToMonth}
        />
      ) : null}

      {!authView && screen === 'config' && apiKey ? (
        <ConfigScreen
          key={frameKey}
          spaces={calendarData.spaces}
          types={calendarData.types}
          initialTypeKeys={calendarData.trackedTypeKeys}
          initialSpaceKeys={calendarData.trackedSpaceKeys}
          apiKey={apiKey}
          confirmingRevoke={confirmingRevoke}
          onBack={goToMonth}
          onCopyKey={() => window.api.auth.copyKey()}
          onSignOut={() => void window.api.auth.signOut()}
          onRevoke={() => window.api.auth.revoke()}
        />
      ) : null}

      {!authView && screen === 'month' ? (
        <MonthScreen
          key={frameKey}
          data={calendarData}
          theme={theme}
          initialDetail={monthDetail}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => {
            setConfirmingRevoke(false)
            setScreen('config')
          }}
        />
      ) : null}

      {/* The month view carries a theme toggle in its own top bar, as the design's chrome
          allows. The other screens have nowhere to put one, so the harness carries it —
          keeping every floating dev control in a single corner. Development only: its
          frames force the session through a channel main registers only in development. */}
      {import.meta.env.DEV ? (
        <FlowSwitcher
          frames={FRAMES}
          activeId={stateToFrame({
            session,
            screen,
            confirmingRevoke,
            showDetail: monthDetail !== undefined
          })}
          theme={theme}
          onSelect={openFrame}
          onToggleTheme={toggleTheme}
        />
      ) : null}
    </>
  )
}

export default App
