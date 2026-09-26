import type { AnytypeDialectProbe } from '@anytype-calendar/anytype-client/infrastructure'
import type {
  EventsGateway,
  EventsGatewayResult,
  EventsObjectRef,
  EventsSource,
  EventsWindow
} from '../../domain'

/** Reads through v2 where Anytype serves it, and through v1 where it does not. */
export class AnytypeEventsGateway implements EventsGateway {
  readonly #probe: AnytypeDialectProbe
  readonly #v1: EventsGateway
  readonly #v2: EventsGateway

  constructor({ probe, v1, v2 }: { probe: AnytypeDialectProbe; v1: EventsGateway; v2: EventsGateway }) {
    this.#probe = probe
    this.#v1 = v1
    this.#v2 = v2
  }

  async listObjects(
    apiKey: string,
    source: EventsSource,
    window: EventsWindow
  ): Promise<EventsGatewayResult<EventsObjectRef[]>> {
    const probed = await this.#probe.probe(apiKey)
    if (!probed.ok) return { ok: false, failure: 'unauthorized' }
    const gateway = probed.dialect === 'v2' ? this.#v2 : this.#v1
    return gateway.listObjects(apiKey, source, window)
  }
}
