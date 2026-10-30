import { setTimeout as sleep } from 'timers/promises'
import type { AnytypeClient } from '@ablunier/anytype-client'
import {
  CompleteEventsObject,
  CreateEventsObject,
  EventsSpanStore,
  LoadEventsSpan,
  RescheduleEventsObject,
  ResetEventsSpan
} from '@anytype-calendar/events/application'
import {
  eventsSpanWindow,
  shownEventsSpan,
  type EventsApiKeySource,
  type EventsDay,
  type EventsGateway,
  type EventsSourceSelection,
  type EventsSpan,
  type EventsTimeZone,
  type EventsWindow,
  type EventsWriter
} from '@anytype-calendar/events/domain'
import {
  AnytypeEventsGateway,
  AnytypeEventsWriter,
  InMemoryEventsGateway,
  LocalEventsTimeZone
} from '@anytype-calendar/events/infrastructure'
import type { Anytype } from '../anytype/compose-anytype'

export interface EventsDeps {
  anytype: Anytype
  apiKeys: EventsApiKeySource
  sources: EventsSourceSelection
  /** The span a launch opens on, around `today`. */
  defaultSpan: (today: EventsDay) => EventsSpan
}

export type Events = ReturnType<typeof composeEvents>

export function composeEvents({ anytype, apiKeys, sources, defaultSpan }: EventsDeps) {
  const zone = new LocalEventsTimeZone()
  const openingSpan = (): EventsSpan => defaultSpan(zone.dayOf(Date.now()))
  const eventsState = new EventsSpanStore()
  const { gateway, writer } = anytype.kind === 'real' ? anytypeEvents(anytype.client) : inMemoryEvents(zone)
  const loadEventsSpan = new LoadEventsSpan({
    gateway,
    apiKeys,
    sources,
    zone,
    store: eventsState,
    // A launch opens on the view last chosen, so the first read is the one the window draws.
    defaultSpan: openingSpan
  })
  const editDeps = { writer, apiKeys, sources, zone, store: eventsState, load: loadEventsSpan }
  return {
    eventsState,
    loadEventsSpan,
    resetEventsSpan: new ResetEventsSpan(eventsState),
    rescheduleEventsObject: new RescheduleEventsObject(editDeps),
    createEventsObject: new CreateEventsObject(editDeps),
    completeEventsObject: new CompleteEventsObject(editDeps),
    /** The span on screen, or before any, the one a launch opens on. */
    shownWindow: (): EventsWindow => eventsSpanWindow(shownEventsSpan(eventsState.get()) ?? openingSpan(), zone)
  }
}

function anytypeEvents(client: AnytypeClient): { gateway: EventsGateway; writer: EventsWriter } {
  return {
    gateway: new AnytypeEventsGateway({ client, warn: (message) => console.warn(message) }),
    writer: new AnytypeEventsWriter(client)
  }
}

/** One fake for both, so an edit shows on the next read. */
function inMemoryEvents(zone: EventsTimeZone): { gateway: EventsGateway; writer: EventsWriter } {
  const fake = new InMemoryEventsGateway({ sleep: (ms) => sleep(ms), zone, now: Date.now })
  return { gateway: fake, writer: fake }
}
