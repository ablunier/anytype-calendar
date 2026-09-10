import { useState } from 'react'
import type { AuthStage, DetailTarget, ScreenId } from './types'
import { FlowSwitcher } from './components/app/FlowSwitcher'
import { useTheme } from './hooks/useTheme'
import { DETAIL_FRAME_EVENT_ID, FRAMES, frameToState, stateToFrame } from './lib/frames'
import { calendarData, onboardingDefaults } from './mocks'
import { AuthScreen } from './screens/auth/AuthScreen'
import { ConfigScreen } from './screens/config/ConfigScreen'
import { MonthScreen } from './screens/month/MonthScreen'
import { OnboardingScreen } from './screens/onboarding/OnboardingScreen'

/**
 * The renderer's root: the screen switcher, the theme, and the only module that reads the
 * mock data.
 *
 * Everything below here takes what it draws through props, so swapping `calendarData` for
 * an IPC-fed source in a later pass touches this file and nothing else. Navigation is
 * local state by design — the flow has four screens and no URLs, so a router would only
 * add indirection.
 */
function App(): React.JSX.Element {
  const [theme, toggleTheme] = useTheme()
  const [screen, setScreen] = useState<ScreenId>('auth')
  const [authStage, setAuthStage] = useState<AuthStage>('start')
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [monthDetail, setMonthDetail] = useState<DetailTarget | undefined>(undefined)
  /* Remounts MonthScreen and ConfigScreen when a frame is picked, so their internal state
   * (open panel, open dialog) starts from that frame rather than from wherever the user
   * had left it. */
  const [frameKey, setFrameKey] = useState(0)

  const openFrame = (id: string): void => {
    const next = frameToState(id)
    setFrameKey((key) => key + 1)
    setScreen(next.screen)
    setAuthStage(next.authStage)
    setConfirmingRevoke(next.confirmingRevoke)
    setMonthDetail(
      next.showDetail
        ? {
            kind: 'object',
            event: calendarData.events.find((e) => e.id === DETAIL_FRAME_EVENT_ID)!
          }
        : undefined
    )
  }

  const goToMonth = (): void => {
    setFrameKey((key) => key + 1)
    setMonthDetail(undefined)
    setScreen('month')
  }

  return (
    <>
      {screen === 'auth' ? (
        <AuthScreen
          stage={authStage}
          spaces={calendarData.spaces}
          onStageChange={setAuthStage}
          onConnected={() => setScreen('onboarding')}
        />
      ) : null}

      {screen === 'onboarding' ? (
        <OnboardingScreen
          spaces={calendarData.spaces}
          types={calendarData.types}
          initialTypeKeys={onboardingDefaults.typeKeys}
          initialSpaceKeys={onboardingDefaults.spaceKeys}
          onContinue={goToMonth}
          onSkip={goToMonth}
        />
      ) : null}

      {screen === 'config' ? (
        <ConfigScreen
          key={frameKey}
          spaces={calendarData.spaces}
          types={calendarData.types}
          initialTypeKeys={calendarData.trackedTypeKeys}
          initialSpaceKeys={calendarData.trackedSpaceKeys}
          confirmingRevoke={confirmingRevoke}
          onBack={goToMonth}
          onSignOut={() => {
            setAuthStage('start')
            setScreen('auth')
          }}
        />
      ) : null}

      {screen === 'month' ? (
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
          keeping every floating dev control in a single corner. */}
      <FlowSwitcher
        frames={FRAMES}
        activeId={stateToFrame({
          screen,
          authStage,
          confirmingRevoke,
          showDetail: monthDetail !== undefined
        })}
        theme={theme}
        onSelect={openFrame}
        onToggleTheme={toggleTheme}
      />
    </>
  )
}

export default App
