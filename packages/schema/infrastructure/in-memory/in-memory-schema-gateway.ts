import type {
  SchemaGateway,
  SchemaGatewayResult,
  SchemaProperty,
  SchemaSpaceRef
} from '../../domain'

export interface InMemorySchemaSpace {
  id: string
  name: string
  properties: SchemaProperty[]
  /** What a search over the space's user date properties reports. */
  datedObjectCount: number
}

export interface InMemorySchemaGatewayOptions {
  sleep: (ms: number) => Promise<void>
  spaces?: InMemorySchemaSpace[]
  requestLatencyMs?: number
}

const SYSTEM_PROPERTIES: SchemaProperty[] = [
  { key: 'created_date', name: 'Creation date', format: 'date' },
  { key: 'last_modified_date', name: 'Last modified date', format: 'date' },
  { key: 'tag', name: 'Tag', format: 'multi_select' }
]

/** The design's sample account. */
export const IN_MEMORY_SCHEMA_SPACES: InMemorySchemaSpace[] = [
  {
    id: 'sp_personal',
    name: 'Personal',
    properties: [
      ...SYSTEM_PROPERTIES,
      { key: 'due_date', name: 'Due date', format: 'date' },
      { key: 'start_date', name: 'Start date', format: 'date' }
    ],
    datedObjectCount: 128
  },
  {
    id: 'sp_studio',
    name: 'Studio',
    properties: [...SYSTEM_PROPERTIES, { key: 'due_date', name: 'Due date', format: 'date' }],
    datedObjectCount: 96
  },
  {
    id: 'sp_reading',
    name: 'Reading',
    properties: [...SYSTEM_PROPERTIES, { key: 'finish_date', name: 'Finished on', format: 'date' }],
    datedObjectCount: 64
  },
  {
    id: 'sp_archive',
    name: 'Archive 2024',
    properties: [...SYSTEM_PROPERTIES, { key: 'closed_on', name: 'Closed on', format: 'date' }],
    datedObjectCount: 212
  }
]

/** Simulates the Anytype local API's schema reads with no I/O. Accepts any key. */
export class InMemorySchemaGateway implements SchemaGateway {
  readonly #sleep: (ms: number) => Promise<void>
  readonly #spaces: InMemorySchemaSpace[]
  readonly #requestLatencyMs: number

  constructor({
    sleep,
    spaces = IN_MEMORY_SCHEMA_SPACES,
    requestLatencyMs = 400
  }: InMemorySchemaGatewayOptions) {
    this.#sleep = sleep
    this.#spaces = spaces
    this.#requestLatencyMs = requestLatencyMs
  }

  async listSpaces(): Promise<SchemaGatewayResult<SchemaSpaceRef[]>> {
    await this.#sleep(this.#requestLatencyMs)
    return { ok: true, value: this.#spaces.map(({ id, name }) => ({ id, name })) }
  }

  async listProperties(
    _apiKey: string,
    spaceId: string
  ): Promise<SchemaGatewayResult<SchemaProperty[]>> {
    await this.#sleep(this.#requestLatencyMs)
    return { ok: true, value: this.#space(spaceId).properties.map((property) => ({ ...property })) }
  }

  async countObjectsWithAnyValue(
    _apiKey: string,
    spaceId: string
  ): Promise<SchemaGatewayResult<number>> {
    await this.#sleep(this.#requestLatencyMs)
    return { ok: true, value: this.#space(spaceId).datedObjectCount }
  }

  #space(spaceId: string): InMemorySchemaSpace {
    const space = this.#spaces.find(({ id }) => id === spaceId)
    // Anytype answers 404 for an unknown space, which AnytypeSchemaGateway rejects on too.
    if (!space) throw new Error(`No space ${spaceId}`)
    return space
  }
}
