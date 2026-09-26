import type {
  SchemaGateway,
  SchemaGatewayResult,
  SchemaProperty,
  SchemaSelectOption,
  SchemaSpaceList,
  SchemaTypeIcon,
  SchemaTypeRef
} from '../../domain'

export interface InMemorySchemaType {
  key: string
  name: string
  icon: SchemaTypeIcon | null
  properties: SchemaProperty[]
}

export interface InMemorySchemaSpace {
  id: string
  name: string
  types: InMemorySchemaType[]
  /** By property key: as in Anytype, a property's options are the space's, not a type's. */
  options?: Record<string, SchemaSelectOption[]>
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
  dates: SchemaProperty[]
): InMemorySchemaType {
  return { key, name, icon, properties: [...dates, ...SYSTEM_PROPERTIES] }
}

const DONE: SchemaProperty = { key: 'done', name: 'Done', format: 'checkbox' }
const LOCATION: SchemaProperty = { key: 'location', name: 'Location', format: 'text' }
const PRIORITY: SchemaProperty = { key: 'priority', name: 'Priority', format: 'select' }
const PRIORITY_OPTIONS: SchemaSelectOption[] = [
  { name: 'High', color: 'red' },
  { name: 'Medium', color: 'orange' },
  { name: 'Low', color: 'blue' }
]

const TASK = { name: 'checkbox', color: 'lime' }
const PROJECT = { name: 'hammer', color: 'orange' }

/**
 * The design's sample account. Each space's Note has only system dates, so it never shows.
 * Tasks can be ticked done and coloured by priority, and meetings have a location, as under v2.
 */
export const IN_MEMORY_SCHEMA_SPACES: InMemorySchemaSpace[] = [
  {
    id: 'sp_personal',
    name: 'Personal',
    types: [
      type('task', 'Task', TASK, [date('due_date', 'Due date'), DONE, PRIORITY]),
      type(
        'meeting',
        'Meeting',
        { name: 'people', color: 'teal' },
        [date('start_date', 'Start date'), date('end_date', 'End date'), LOCATION]
      ),
      type('contact', 'Person', { name: 'person-circle', color: 'pink' }, [date('birthday', 'Birthday')]),
      type('note', 'Note', { name: 'create', color: 'yellow' }, [])
    ],
    options: { priority: PRIORITY_OPTIONS }
  },
  {
    id: 'sp_studio',
    name: 'Studio',
    types: [
      type(
        'project',
        'Project',
        PROJECT,
        [date('start_date', 'Start date'), date('due_date', 'Due date')]
      ),
      type('task', 'Task', TASK, [date('due_date', 'Due date'), DONE, PRIORITY]),
      type(
        'invoice',
        'Invoice',
        { name: 'receipt', color: 'red' },
        [date('issued_on', 'Issued on'), date('due_date', 'Due date')]
      ),
      type('note', 'Note', { name: 'create', color: 'yellow' }, [])
    ],
    options: { priority: PRIORITY_OPTIONS }
  },
  {
    id: 'sp_reading',
    name: 'Reading',
    types: [
      type(
        'book',
        'Book',
        { name: 'book', color: 'purple' },
        [date('start_date', 'Start date'), date('finish_date', 'Finish date')]
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
        [date('start_date', 'Start date'), date('closed_on', 'Closed on')]
      ),
      type('task', 'Task', TASK, [date('due_date', 'Due date')])
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

  async listSpaces(): Promise<SchemaGatewayResult<SchemaSpaceList>> {
    await this.#sleep(this.#requestLatencyMs)
    return {
      ok: true,
      value: { spaces: this.#spaces.map(({ id, name }) => ({ id, name })), hasNotGrantedSpaces: false }
    }
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

  async listSelectOptions(
    _apiKey: string,
    spaceId: string,
    propertyKey: string
  ): Promise<SchemaGatewayResult<SchemaSelectOption[]>> {
    await this.#sleep(this.#requestLatencyMs)
    const options = this.#space(spaceId).options?.[propertyKey] ?? []
    return { ok: true, value: options.map((option) => ({ ...option })) }
  }

  #space(spaceId: string): InMemorySchemaSpace {
    const space = this.#spaces.find(({ id }) => id === spaceId)
    // Anytype answers 404 for an unknown space, which AnytypeSchemaGateway rejects on too.
    if (!space) throw new Error(`No space ${spaceId}`)
    return space
  }
}
