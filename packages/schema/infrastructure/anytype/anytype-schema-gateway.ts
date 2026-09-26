import type { AnytypeDialectProbe } from '@anytype-calendar/anytype-client/infrastructure'
import type {
  SchemaGateway,
  SchemaGatewayResult,
  SchemaSelectOption,
  SchemaSpaceList,
  SchemaTypeRef
} from '../../domain'

/** Reads through v2 where Anytype serves it, and through v1 where it does not. */
export class AnytypeSchemaGateway implements SchemaGateway {
  readonly #probe: AnytypeDialectProbe
  readonly #v1: SchemaGateway
  readonly #v2: SchemaGateway

  constructor({ probe, v1, v2 }: { probe: AnytypeDialectProbe; v1: SchemaGateway; v2: SchemaGateway }) {
    this.#probe = probe
    this.#v1 = v1
    this.#v2 = v2
  }

  async listSpaces(apiKey: string): Promise<SchemaGatewayResult<SchemaSpaceList>> {
    const gateway = await this.#pick(apiKey)
    return gateway ? gateway.listSpaces(apiKey) : { ok: false, failure: 'unauthorized' }
  }

  async listTypes(apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaTypeRef[]>> {
    const gateway = await this.#pick(apiKey)
    return gateway ? gateway.listTypes(apiKey, spaceId) : { ok: false, failure: 'unauthorized' }
  }

  async listSelectOptions(
    apiKey: string,
    spaceId: string,
    propertyKey: string
  ): Promise<SchemaGatewayResult<SchemaSelectOption[]>> {
    const gateway = await this.#pick(apiKey)
    return gateway
      ? gateway.listSelectOptions(apiKey, spaceId, propertyKey)
      : { ok: false, failure: 'unauthorized' }
  }

  async #pick(apiKey: string): Promise<SchemaGateway | null> {
    const probed = await this.#probe.probe(apiKey)
    if (!probed.ok) return null
    return probed.dialect === 'v2' ? this.#v2 : this.#v1
  }
}
