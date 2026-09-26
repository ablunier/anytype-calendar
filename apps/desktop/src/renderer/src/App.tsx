import { useState } from 'react'
import type { EventsSpan } from '@anytype-calendar/events/domain'
import { EMPTY_SCHEMA_SELECTION } from '@anytype-calendar/schema/domain'
import type { AuthView, CalendarView, ConnectedScreen } from './types'
import { useApiVersion } from './hooks/useApiVersion'
import { useCalendarView } from './hooks/useCalendarView'
import { useEvents } from './hooks/useEvents'
import { useLocale } from './hooks/useLocale'
import { useNow } from './hooks/useNow'
import { useSchemaSelection } from './hooks/useSchemaSelection'
import { useSchemaSync } from './hooks/useSchemaSync'
import { useSession } from './hooks/useSession'
import { useTheme } from './hooks/useTheme'
import { TimeFormatContext } from './hooks/TimeFormatContext'
import { useTimeFormat } from './hooks/useTimeFormat'
import { useWeekNumbers } from './hooks/useWeekNumbers'
import { useWeekStart } from './hooks/useWeekStart'
import { withDates } from './lib/calendar'
import {
  anchorOf,
  eventsFor,
  localDate,
  shiftSpan,
  shownSpanFor,
  spanFor,
  spanStatusFor,
  switchDateFor
} from './lib/events'
import {
  hasNotGrantedSpaces,
  isOnboarded,
  picksFor,
  schemaSelectionFor,
  spacesFor,
  syncViewFor,
  tracksAnyType,
  typesFor
} from './lib/schema'
import { apiAccessFor, apiKeyFor, authViewFor } from './lib/session'
import { AuthScreen } from './screens/auth/AuthScreen'
import { ConfigScreen } from './screens/config/ConfigScreen'
import { CalendarScreen } from './screens/calendar/CalendarScreen'
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
  const [, language, setLanguage] = useLocale()
  const [showWeekNumbers, setShowWeekNumbers] = useWeekNumbers()
  const [weekStart, setWeekStart] = useWeekStart()
  const [timeFormat, setTimeFormat] = useTimeFormat()
  const [calendarView, setCalendarView] = useCalendarView()
  const [apiVersion, setApiVersion] = useApiVersion()
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
    if (session?.phase === 'connected') setScreen(phase === undefined ? 'calendar' : 'success')
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
      setScreen('calendar')
    }
    return (
      <OnboardingScreen
        spaces={spacesFor(schema)}
        types={types}
        sync={syncViewFor(schema, now)}
        hasNotGrantedSpaces={hasNotGrantedSpaces(schema)}
        initial={picksFor(selection, types)}
        onRetrySync={() => void window.api.schema.sync()}
        onContinue={(picks) => void save(schemaSelectionFor(schema, picks, selection))}
        // Skipping on first run saves an empty selection; later, it keeps what was saved.
        onSkip={() => (isOnboarded(selection) ? setScreen('calendar') : void save())}
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
        hasNotGrantedSpaces={hasNotGrantedSpaces(schema)}
        initial={picksFor(selection, types)}
        apiKey={apiKey}
        access={apiAccessFor(session)}
        apiVersion={apiVersion}
        onApiVersion={setApiVersion}
        language={language}
        onLanguage={setLanguage}
        showWeekNumbers={showWeekNumbers}
        onShowWeekNumbers={setShowWeekNumbers}
        weekStart={weekStart}
        onWeekStart={setWeekStart}
        timeFormat={timeFormat}
        onTimeFormat={setTimeFormat}
        calendarView={calendarView}
        onCalendarView={setCalendarView}
        onBack={() => setScreen('calendar')}
        onReread={() => void window.api.schema.sync()}
        onSave={(picks) =>
          window.api.schemaSelection.save(schemaSelectionFor(schema, picks, selection))
        }
        onCopyKey={() => window.api.auth.copyKey()}
        onSignOut={() => void window.api.auth.signOut()}
      />
    )
  }

  const span = shownSpanFor(events, calendarView, now)
  const showSpan = (next: EventsSpan): void => {
    void window.api.events.showSpan(next)
  }
  /* Switching view saves the choice and asks for the new span in one go: the preference is
   * what the next launch opens on, the span is what this window draws. */
  const showView = (view: CalendarView): void => {
    setCalendarView(view)
    showSpan(spanFor(view, switchDateFor(span, localDate(now)), weekStart))
  }
  const types = typesFor(schema)
  const picks = picksFor(selection, types)
  const today = localDate(now)
  return (
    <TimeFormatContext value={timeFormat}>
      <CalendarScreen
        key={`${span.kind}-${anchorOf(span)}`}
        span={span}
        events={eventsFor(events, span)}
        status={spanStatusFor(events, span, now)}
        types={withDates(types, picks.dates)}
        spaces={spacesFor(schema)}
        trackedSpaceKeys={picks.spaceKeys}
        tracksAnything={tracksAnyType(selection)}
        today={today}
        nowMinute={minutesOf(now)}
        theme={theme}
        showWeekNumbers={showWeekNumbers}
        weekStart={weekStart}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setScreen('config')}
        onView={showView}
        onPrev={() => showSpan(shiftSpan(span, -1))}
        onNext={() => showSpan(shiftSpan(span, 1))}
        onToday={() => showSpan(spanFor(span.kind, localDate(Date.now()), weekStart))}
        onReread={() => {
          void window.api.schema.sync()
          showSpan(span)
        }}
      />
    </TimeFormatContext>
  )
}

/** Minutes from local midnight. `instant` is epoch milliseconds. */
function minutesOf(instant: number): number {
  const date = new Date(instant)
  return date.getHours() * 60 + date.getMinutes()
}

export default App
