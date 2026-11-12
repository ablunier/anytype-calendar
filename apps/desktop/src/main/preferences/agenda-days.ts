import { type EventsAgendaDays, toEventsAgendaDays } from '@anytype-calendar/events/domain'

export function toAgendaDays(value: unknown): EventsAgendaDays | undefined {
  return toEventsAgendaDays(value) ?? undefined
}
