import { useState } from 'react'
import { shiftEventsMonth } from '@anytype-calendar/events/domain'
import { EMPTY_SCHEMA_SELECTION } from '@anytype-calendar/schema/domain'
import type { AuthView, CalendarMonth, ConnectedScreen } from './types'
import { useEvents } from './hooks/useEvents'
import { useNow } from './hooks/useNow'
import { useSchemaSelection } from './hooks/useSchemaSelection'
import { useSchemaSync } from './hooks/useSchemaSync'
import { useSession } from './hooks/useSession'
import { useTheme } from './hooks/useTheme'
import { useWeekNumbers } from './hooks/useWeekNumbers'
import { withDates } from './lib/calendar'
import { eventsFor, localDate, monthOf, monthStatusFor, shownMonthFor } from './lib/events'
import {
  isOnboarded,
  picksFor,
  schemaSelectionFor,
  spacesFor,
  syncViewFor,
  tracksAnyType,
  typesFor
} from './lib/schema'
import { apiKeyFor, authViewFor } from './lib/session'
import { AuthScreen } from './screens/auth/AuthScreen'
import { ConfigScreen } from './screens/config/ConfigScreen'
import { MonthScreen } from './screens/month/MonthScreen'
import { OnboardingScreen } from './screens/onboarding/OnboardingScreen'

/** Often enough for "synced 3 min ago" to stay true, and for today to move soon after midnight. */
const SYNC_AGE_TICK_MS = 30_000

/**
 * The renderer's root: the screen switcher and the theme.
 *
 * Until the session is connected, what is on screen is derived from the auth session main
 * pushes, and every auth button is an intent sent back over IPC. Once connected, moving
 * between the remaining screens is local state by design — four screens and no URLs, so a
 * router would only add indirection — with one rule derived from main instead: until a
 * selection has been saved, every screen past the success card is onboarding. So a key
 * restored at launch still gets onboarding if it was never finished, and saving is what
 * lets the calendar through. The month on screen is main's too: the arrows ask main for
 * another month, and the grid follows what it pushes back. Everything below here takes what
 * it draws through props.
 */
function App(): React.JSX.Element | null {
  const [theme, toggleTheme] = useTheme()
  const [showWeekNumbers, setShowWeekNumbers] = useWeekNumbers()
  const session = useSession()
  const schema = useSchemaSync()
  const selection = useSchemaSelection()
  const events = useEvents()
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

  if (!session || !schema || !selection || !events) return null

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
        onEnterKey={() => void window.api.auth.enterKey()}
        onSubmitCode={(code) => void window.api.auth.submitCode(code)}
        onSubmitApiKey={(apiKey) => void window.api.auth.submitApiKey(apiKey)}
        onStepBack={() => void window.api.auth.stepBack()}
        onRetrySync={() => void window.api.schema.sync()}
        onContinue={() => setScreen('onboarding')}
      />
    )
  }

  if (screen === 'onboarding' || !isOnboarded(selection)) {
    const types = typesFor(schema)
    // A failed save rejects and leaves the user here, picks intact, to try again.
    const save = async (next = EMPTY_SCHEMA_SELECTION): Promise<void> => {
      await window.api.schemaSelection.save(next)
      setScreen('month')
    }
    return (
      <OnboardingScreen
        spaces={spacesFor(schema)}
        types={types}
        sync={syncViewFor(schema, now)}
        initial={picksFor(selection, types)}
        onRetrySync={() => void window.api.schema.sync()}
        onContinue={(picks) => void save(schemaSelectionFor(schema, picks, selection))}
        // Skipping on first run saves an empty selection; later, it keeps what was saved.
        onSkip={() => (isOnboarded(selection) ? setScreen('month') : void save())}
      />
    )
  }

  if (screen === 'config' && apiKey) {
    const types = typesFor(schema)
    return (
      <ConfigScreen
        spaces={spacesFor(schema)}
        types={types}
        sync={syncViewFor(schema, now)}
        initial={picksFor(selection, types)}
        apiKey={apiKey}
        showWeekNumbers={showWeekNumbers}
        onShowWeekNumbers={setShowWeekNumbers}
        onBack={() => setScreen('month')}
        onReread={() => void window.api.schema.sync()}
        onSave={(picks) =>
          window.api.schemaSelection.save(schemaSelectionFor(schema, picks, selection))
        }
        onCopyKey={() => window.api.auth.copyKey()}
        onSignOut={() => void window.api.auth.signOut()}
      />
    )
  }

  const month = shownMonthFor(events, now)
  const showMonth = (next: CalendarMonth): void => {
    void window.api.events.showMonth(next)
  }
  const types = typesFor(schema)
  const picks = picksFor(selection, types)
  return (
    <MonthScreen
      key={`${month.year}-${month.month}`}
      month={month}
      events={eventsFor(events, month)}
      status={monthStatusFor(events, month, now)}
      types={withDates(types, picks.dates)}
      spaces={spacesFor(schema)}
      trackedSpaceKeys={picks.spaceKeys}
      tracksAnything={tracksAnyType(selection)}
      today={localDate(now)}
      theme={theme}
      showWeekNumbers={showWeekNumbers}
      onToggleTheme={toggleTheme}
      onOpenSettings={() => setScreen('config')}
      onPrevMonth={() => showMonth(shiftEventsMonth(month, -1))}
      onNextMonth={() => showMonth(shiftEventsMonth(month, 1))}
      onToday={() => showMonth(monthOf(Date.now()))}
      onReread={() => {
        void window.api.schema.sync()
        showMonth(month)
      }}
    />
  )
}

export default App
