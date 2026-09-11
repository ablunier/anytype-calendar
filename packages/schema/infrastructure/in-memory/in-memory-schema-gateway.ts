import type {
  SchemaGateway,
  SchemaGatewayResult,
  SchemaProperty,
  SchemaSpaceRef,
  SchemaTypeIcon,
  SchemaTypeRef
} from '../../domain'

export interface InMemorySchemaType {
  key: string
  name: string
  icon: SchemaTypeIcon | null
  properties: SchemaProperty[]
  /** What a search over the type's user date properties reports. */
  datedObjectCount: number
}

export interface InMemorySchemaSpace {
  id: string
  name: string
  types: InMemorySchemaType[]
}

export interface InMemorySchemaGatewayOptions {
  sleep: (ms: number) => Promise<void>
  spaces?: InMemorySchemaSpace[]
  requestLatencyMs?: number
}

const date = (key: string, name: string): SchemaProperty => ({ key, name, format: 'date' })

const SYSTEM_PROPERTIES: SchemaProperty[] = [
  date('created_date', 'Creation date'),
  date('last_modified_date', 'Last modified date'),
  { key: 'tag', name: 'Tag', format: 'multi_select' }
]

function type(
  key: string,
  name: string,
  icon: SchemaTypeIcon,
  dates: SchemaProperty[],
  datedObjectCount: number
): InMemorySchemaType {
  return { key, name, icon, properties: [...dates, ...SYSTEM_PROPERTIES], datedObjectCount }
}

const TASK = { name: 'checkbox', color: 'lime' }
const PROJECT = { name: 'hammer', color: 'orange' }

/** The design's sample account. Each space's Note has only system dates, so it never shows. */
export const IN_MEMORY_SCHEMA_SPACES: InMemorySchemaSpace[] = [
  {
    id: 'sp_personal',
    name: 'Personal',
    types: [
      type('task', 'Task', TASK, [date('due_date', 'Due date')], 54),
      type(
        'meeting',
        'Meeting',
        { name: 'people', color: 'teal' },
        [date('start_date', 'Start date'), date('end_date', 'End date')],
        18
      ),
      type('contact', 'Person', { name: 'person-circle', color: 'pink' }, [date('birthday', 'Birthday')], 25),
      type('note', 'Note', { name: 'create', color: 'yellow' }, [], 0)
    ]
  },
  {
    id: 'sp_studio',
    name: 'Studio',
    types: [
      type(
        'project',
        'Project',
        PROJECT,
        [date('start_date', 'Start date'), date('due_date', 'Due date')],
        12
      ),
      type('task', 'Task', TASK, [date('due_date', 'Due date')], 47),
      type(
        'invoice',
        'Invoice',
        { name: 'receipt', color: 'red' },
        [date('issued_on', 'Issued on'), date('due_date', 'Due date')],
        7
      ),
      type('note', 'Note', { name: 'create', color: 'yellow' }, [], 0)
    ]
  },
  {
    id: 'sp_reading',
    name: 'Reading',
    types: [
      type(
        'book',
        'Book',
        { name: 'book', color: 'purple' },
        [date('start_date', 'Start date'), date('finish_date', 'Finish date')],
        22
      )
    ]
  },
  {
    id: 'sp_archive',
    name: 'Archive 2024',
    types: [
      type(
        'project',
        'Project',
        PROJECT,
        [date('start_date', 'Start date'), date('closed_on', 'Closed on')],
        88
      ),
      type('task', 'Task', TASK, [date('due_date', 'Due date')], 124)
    ]
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

  async listTypes(_apiKey: string, spaceId: string): Promise<SchemaGatewayResult<SchemaTypeRef[]>> {
    await this.#sleep(this.#requestLatencyMs)
    const types = this.#space(spaceId).types.map(({ key, name, icon, properties }) => ({
      key,
      name,
      icon: icon && { ...icon },
      properties: properties.map((property) => ({ ...property }))
    }))
    return { ok: true, value: types }
  }

  async countObjectsWithAnyValue(
    _apiKey: string,
    spaceId: string,
    typeKey: string
  ): Promise<SchemaGatewayResult<number>> {
    await this.#sleep(this.#requestLatencyMs)
    const type = this.#space(spaceId).types.find(({ key }) => key === typeKey)
    return { ok: true, value: type?.datedObjectCount ?? 0 }
  }

  #space(spaceId: string): InMemorySchemaSpace {
    const space = this.#spaces.find(({ id }) => id === spaceId)
    // Anytype answers 404 for an unknown space, which AnytypeSchemaGateway rejects on too.
    if (!space) throw new Error(`No space ${spaceId}`)
    return space
  }
}
