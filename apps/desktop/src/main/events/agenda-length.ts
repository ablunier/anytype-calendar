import {
  type EventsAgendaDays,
  type EventsSpan,
  type EventsSpanLoad,
  shownEventsSpan,
} from '@anytype-calendar/events/domain'

export interface AgendaLengthDeps {
  agendaDays: { subscribe(listener: (days: EventsAgendaDays) => void): unknown }
  eventsState: { get(): EventsSpanLoad }
  loadEventsSpan: { execute(span: EventsSpan): unknown }
}

/**
 * The length lives in the span, so a new one would otherwise only reach the screen at the next
 * step. An agenda shown is read again from the same first day; any other span, or none while
 * signed out, has no length to follow.
 */
export function followAgendaLength({ agendaDays, eventsState, loadEventsSpan }: AgendaLengthDeps): void {
  agendaDays.subscribe((days) => {
    const shown = shownEventsSpan(eventsState.get())
    if (shown?.kind === 'agenda' && shown.days !== days) void loadEventsSpan.execute({ ...shown, days })
  })
}
