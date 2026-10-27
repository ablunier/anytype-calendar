import {
  shiftEventsMonth,
  type EventsCollectionTarget,
  type EventsDateChanges,
  type EventsDetailRef,
  type EventsGateway,
  type EventsGatewayResult,
  type EventsLinkedObject,
  type EventsMonth,
  type EventsNewObject,
  type EventsObjectRef,
  type EventsObjectTarget,
  type EventsPanelProperty,
  type EventsSource,
  type EventsTimeZone,
  type EventsWriteResult,
  type EventsWriter
} from '../../domain'

export interface InMemoryEventsObject {
  id: string
  spaceId: string
  typeKey: string
  title: string
  /** Epoch milliseconds by property key. */
  dates: Record<string, number>
  done?: boolean
  location?: string
  /** Option names by select property key. */
  options?: Record<string, string>
  /**
   * Every other property's value by key, as a v2 search row gives it: option names and linked
   * ids in lists. A checkbox or text other than Anytype's own Done and Location is read from
   * here.
   */
  values?: Record<string, unknown>
}

export interface InMemoryEventsMember {
  spaceId: string
  /** Linked from an object as `participant-<identity>`. */
  identity: string
  name: string
}

/** A query over one type, whose views can each leave out the objects ticked done. */
export interface InMemoryEventsQuery {
  id: string
  spaceId: string
  typeKey: string
  /** In order: the first is read when no view is chosen. */
  views: { id: string; openOnly: boolean }[]
}

export interface InMemoryEventsGatewayOptions {
  sleep: (ms: number) => Promise<void>
  zone: EventsTimeZone
  now: () => number
  /** Defaults to inMemoryEventsSample around the month `now` falls in. */
  objects?: InMemoryEventsObject[]
  /** Defaults to IN_MEMORY_EVENTS_QUERIES. */
  queries?: InMemoryEventsQuery[]
  /** Defaults to IN_MEMORY_EVENTS_MEMBERS. */
  members?: InMemoryEventsMember[]
  requestLatencyMs?: number
}

/** IN_MEMORY_SCHEMA_SPACES' queries, by the same ids. */
export const IN_MEMORY_EVENTS_QUERIES: InMemoryEventsQuery[] = [
  {
    id: 'q_open_tasks',
    spaceId: 'sp_studio',
    typeKey: 'task',
    views: [
      { id: 'v_open', openOnly: true },
      { id: 'v_all', openOnly: false }
    ]
  }
]

export const IN_MEMORY_EVENTS_MEMBERS: InMemoryEventsMember[] = [
  { spaceId: 'sp_personal', identity: 'A8mara', name: 'Mara' },
  { spaceId: 'sp_personal', identity: 'A8sofia', name: 'Sofia' }
]

/** Anytype's own Done and Location, which the sample keeps as fields of their own. */
const DONE_KEY = 'done'
const LOCATION_KEY = 'location'

const MEMBER_ID_PREFIX = 'participant-'

/** A date `month` months from the seeded month, and `time` as `HH:MM` for a timed one. */
interface SeedDate {
  month: number
  day: number
  time?: string
}

/** `id` stands in for the one made up from the seed's place, for objects others link to. */
type SeedDetails = Partial<Pick<InMemoryEventsObject, 'id' | 'done' | 'location' | 'options' | 'values'>>

type Seed = [
  title: string,
  spaceId: string,
  typeKey: string,
  dates: Record<string, SeedDate>,
  details?: SeedDetails
]

const at = (month: number, day: number, time?: string): SeedDate =>
  time === undefined ? { month, day } : { month, day, time }

const meeting = (
  title: string,
  day: number,
  start: string,
  end: string,
  month = 0,
  details: SeedDetails = {}
): Seed => [
  title,
  'sp_personal',
  'meeting',
  { start_date: at(month, day, start), end_date: at(month, day, end) },
  details
]

const priority = (name: string, values?: Record<string, unknown>): SeedDetails =>
  values === undefined ? { options: { priority: name } } : { options: { priority: name }, values }

/**
 * The design's sample month, keyed to IN_MEMORY_SCHEMA_SPACES' account. Days stay within 28 so
 * every month has them.
 */
const SEEDS: Seed[] = [
  meeting('Weekly planning', 2, '10:00', '11:00', 0, {
    location: 'Studio, room 2',
    values: {
      attendees: ['participant-A8mara', 'obj_iris'],
      url: 'https://meet.example.com/weekly',
      description: 'Walk through the board, then pick the three things that matter this week.',
      tag: ['Work']
    }
  }),
  ['Draft API notes', 'sp_personal', 'task', { due_date: at(0, 3, '14:30') }, { done: true }],
  ['Docs sprint', 'sp_studio', 'project', { start_date: at(0, 4), due_date: at(0, 6) }, { id: 'obj_docs_sprint' }],
  meeting('Standup', 5, '09:00', '09:30'),
  ['Ship weekly digest', 'sp_studio', 'task', { due_date: at(0, 6, '16:00') }, { done: true }],
  meeting('Design review', 9, '09:30', '10:15'),
  [
    'Rewrite empty states',
    'sp_studio',
    'task',
    { due_date: at(0, 9, '13:00') },
    // A deleted option is served by its object id.
    priority('High', { linked_projects: ['obj_launch_week'], tag: ['Urgent', 'bafyreideletedoption'] })
  ],
  meeting('Sync with Mara', 10, '11:00', '11:45', 0, {
    location: 'Café Central',
    values: { venue: 'Café Central, upstairs', attendees: ['participant-A8mara'] }
  }),
  ['Field notes: local-first', 'sp_personal', 'task', { due_date: at(0, 10) }],
  ['Ship changelog', 'sp_studio', 'task', { due_date: at(0, 11, '15:00') }, priority('Medium')],
  ['Launch week', 'sp_studio', 'project', { start_date: at(0, 12), due_date: at(0, 16) }, { id: 'obj_launch_week' }],
  meeting('Design review', 12, '09:30', '10:15'),
  ['Write release notes', 'sp_studio', 'task', { due_date: at(0, 12, '11:00') }],
  ['Reply to Iris', 'sp_personal', 'task', { due_date: at(0, 12, '14:00') }, priority('Low')],
  ['Close the week', 'sp_personal', 'task', { due_date: at(0, 13, '17:00') }],
  [
    'Seeing Like a State',
    'sp_reading',
    'book',
    { start_date: at(0, 14), finish_date: at(0, 21) },
    { values: { finished: true, pages: 445, tag: ['Home'] } }
  ],
  meeting('Weekly planning', 16, '10:00', '10:30'),
  [
    'Iris',
    'sp_personal',
    'contact',
    { birthday: at(0, 17) },
    { id: 'obj_iris', values: { email: 'iris@example.com', phone: '+34 600 000 000' } }
  ],
  [
    'Sync API contract',
    'sp_studio',
    'task',
    { due_date: at(0, 18, '09:00') },
    priority('High', { linked_projects: ['obj_docs_sprint', 'obj_launch_week'] })
  ],
  ['File taxes', 'sp_archive', 'task', { due_date: at(0, 19) }],
  ['Quarter close', 'sp_studio', 'project', { start_date: at(0, 20), due_date: at(0, 21) }],
  meeting('Interview: Sofia', 23, '11:30', '12:15', 0, {
    values: { attendees: ['participant-A8sofia', 'participant-A8mara'], venue: '' }
  }),
  ['Prune stale objects', 'sp_studio', 'task', { due_date: at(0, 24, '15:00') }],
  ['Weekly digest draft', 'sp_personal', 'task', { due_date: at(0, 26, '09:30') }],
  ['Roadmap pass', 'sp_studio', 'project', { start_date: at(0, 27) }],
  ['Close the month', 'sp_personal', 'task', { due_date: at(0, 28, '16:00') }],

  // Ranges across the month's edges.
  ['Onboarding revamp', 'sp_studio', 'project', { start_date: at(-1, 24), due_date: at(0, 3) }],
  ['The Dawn of Everything', 'sp_reading', 'book', { start_date: at(0, 24), finish_date: at(1, 6) }],
  ['Website relaunch', 'sp_archive', 'project', { start_date: at(-2, 3), closed_on: at(-1, 20) }],

  // The months either side.
  meeting('Retro', 8, '16:00', '17:00', -1),
  ['Renew the domain', 'sp_personal', 'task', { due_date: at(-1, 15) }],
  ['Plan next quarter', 'sp_studio', 'project', { start_date: at(1, 5), due_date: at(1, 9) }],
  ['Dentist', 'sp_personal', 'task', { due_date: at(1, 14, '08:30') }],

  // Monthly, far enough ahead to cross into another year.
  ...[-3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(
    (month): Seed => [
      'Studio invoice',
      'sp_studio',
      'invoice',
      { issued_on: at(month, 1), due_date: at(month, 25, '09:00') },
      { values: { amount: 1250.5, email: 'billing@example.com' } }
    ]
  )
]

/** Seeded around `month`, so the fake account always has something to show wherever it runs. */
export function inMemoryEventsSample(month: EventsMonth, zone: EventsTimeZone): InMemoryEventsObject[] {
  return SEEDS.map(([title, spaceId, typeKey, dates, details = {}], index) => ({
    spaceId,
    typeKey,
    title,
    dates: Object.fromEntries(
      Object.entries(dates).map(([key, seed]) => [key, instantOf(seed, month, zone)])
    ),
    ...details,
    id: details.id ?? `obj_${index + 1}`
  }))
}

/**
 * Simulates the Anytype local API's object search, and its writes to the same objects, with no
 * I/O. Accepts any key, and lets it write anywhere.
 */
export class InMemoryEventsGateway implements EventsGateway, EventsWriter {
  readonly #sleep: (ms: number) => Promise<void>
  readonly #objects: InMemoryEventsObject[]
  readonly #queries: InMemoryEventsQuery[]
  readonly #members: InMemoryEventsMember[]
  readonly #requestLatencyMs: number
  #created = 0
  /** Object ids by `spaceId/collectionId`, in the order they were added. */
  readonly #collections = new Map<string, string[]>()

  constructor({
    sleep,
    zone,
    now,
    objects,
    queries = IN_MEMORY_EVENTS_QUERIES,
    members = IN_MEMORY_EVENTS_MEMBERS,
    requestLatencyMs = 300
  }: InMemoryEventsGatewayOptions) {
    this.#sleep = sleep
    // Copied, since writes change them.
    this.#objects = (objects ?? inMemoryEventsSample(zone.dayOf(now()), zone)).map((object) => ({ ...object }))
    this.#queries = queries
    this.#members = members
    this.#requestLatencyMs = requestLatencyMs
  }

  /**
   * Returns every object of the source with a From value, as the port allows. A query, or a
   * view of one, it does not know holds nothing, as a gone one does in Anytype.
   */
  async listObjects(
    _apiKey: string,
    source: EventsSource
  ): Promise<EventsGatewayResult<EventsObjectRef[]>> {
    await this.#sleep(this.#requestLatencyMs)
    const { spaceId, from, to, done, location, colourBy, panel = [] } = source
    const read = this.#read(source)
    if (!read) return { ok: true, value: [] }
    const refs = this.#objects.flatMap((object) => {
      const start = object.dates[from]
      if (object.spaceId !== spaceId || object.typeKey !== read.typeKey || start === undefined) return []
      if (read.openOnly && isDone(object, done ?? DONE_KEY)) return []
      const ref: EventsObjectRef = {
        id: object.id,
        title: object.title,
        start,
        end: to === null ? null : (object.dates[to] ?? null)
      }
      if (done !== undefined) ref.done = isDone(object, done)
      const place = location === undefined ? undefined : locationOf(object, location)
      if (place) ref.location = place
      const option = colourBy && object.options?.[colourBy.key]
      if (option) ref.option = option
      const details = panel.flatMap((property) => detailOf(object, property))
      if (details.length > 0) ref.details = details
      return [ref]
    })
    return { ok: true, value: refs }
  }

  /** The space's objects, and its members, among `ids`. */
  async listLinkedObjects(
    _apiKey: string,
    spaceId: string,
    ids: readonly string[]
  ): Promise<EventsGatewayResult<EventsLinkedObject[]>> {
    await this.#sleep(this.#requestLatencyMs)
    const wanted = new Set(ids)
    const objects = this.#objects
      .filter((object) => object.spaceId === spaceId && wanted.has(object.id))
      .map(({ id, title }) => ({ id, name: title, member: false }))
    const members = this.#members
      .filter((member) => member.spaceId === spaceId && wanted.has(`${MEMBER_ID_PREFIX}${member.identity}`))
      .map(({ identity, name }) => ({ id: `${MEMBER_ID_PREFIX}${identity}`, name, member: true }))
    return { ok: true, value: [...objects, ...members] }
  }

  async reschedule(
    _apiKey: string,
    target: EventsObjectTarget,
    dates: EventsDateChanges
  ): Promise<EventsWriteResult> {
    await this.#sleep(this.#requestLatencyMs)
    const object = this.#find(target)
    if (!object) return GONE
    const next = { ...object.dates }
    for (const [key, instant] of Object.entries(dates)) {
      if (instant === null) delete next[key]
      else next[key] = instant
    }
    object.dates = next
    return { ok: true, value: null }
  }

  async create(
    _apiKey: string,
    { spaceId, typeKey, name, dates }: EventsNewObject
  ): Promise<EventsWriteResult<{ id: string }>> {
    await this.#sleep(this.#requestLatencyMs)
    const id = `obj_new_${++this.#created}`
    this.#objects.push({ id, spaceId, typeKey, title: name, dates: { ...dates } })
    return { ok: true, value: { id } }
  }

  /** Any collection id is taken: the fake keeps no collections of its own, only what was added. */
  async addToCollection(
    _apiKey: string,
    { spaceId, collectionId }: EventsCollectionTarget,
    objectId: string
  ): Promise<EventsWriteResult> {
    await this.#sleep(this.#requestLatencyMs)
    if (!this.#find({ spaceId, id: objectId })) return GONE
    const items = this.#collections.get(`${spaceId}/${collectionId}`) ?? []
    if (!items.includes(objectId)) this.#collections.set(`${spaceId}/${collectionId}`, [...items, objectId])
    return { ok: true, value: null }
  }

  collectionItems(spaceId: string, collectionId: string): string[] {
    return [...(this.#collections.get(`${spaceId}/${collectionId}`) ?? [])]
  }

  async setDone(
    _apiKey: string,
    target: EventsObjectTarget,
    key: string,
    done: boolean
  ): Promise<EventsWriteResult> {
    await this.#sleep(this.#requestLatencyMs)
    const object = this.#find(target)
    if (!object) return GONE
    if (key === DONE_KEY) object.done = done
    else object.values = { ...object.values, [key]: done }
    return { ok: true, value: null }
  }

  #find({ spaceId, id }: EventsObjectTarget): InMemoryEventsObject | undefined {
    return this.#objects.find((object) => object.spaceId === spaceId && object.id === id)
  }

  #read(source: EventsSource): { typeKey: string; openOnly: boolean } | null {
    if (source.kind === 'type') return { typeKey: source.typeKey, openOnly: false }
    const query = this.#queries.find(
      ({ id, spaceId }) => id === source.queryId && spaceId === source.spaceId
    )
    const view =
      source.viewId === null ? query?.views[0] : query?.views.find(({ id }) => id === source.viewId)
    return query && view ? { typeKey: query.typeKey, openOnly: view.openOnly } : null
  }
}

const GONE = { ok: false, failure: 'rejected', message: 'object not found' } as const

function isDone(object: InMemoryEventsObject, key: string): boolean {
  return (key === DONE_KEY ? object.done : object.values?.[key]) === true
}

function locationOf(object: InMemoryEventsObject, key: string): string | undefined {
  const value = key === LOCATION_KEY ? object.location : object.values?.[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** As AnytypeV2EventsGateway reads a row: nothing for no value, or one of another shape. */
function detailOf(object: InMemoryEventsObject, { key, format }: EventsPanelProperty): EventsDetailRef[] {
  const value = object.values?.[key]
  switch (format) {
    case 'number':
      return typeof value === 'number' ? [{ key, format, value }] : []
    case 'select':
    case 'multi_select':
    case 'objects': {
      const items = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
      if (items.length === 0) return []
      return format === 'objects' ? [{ key, format, ids: items }] : [{ key, format, names: items }]
    }
    default:
      return typeof value === 'string' && value !== '' ? [{ key, format, value }] : []
  }
}

function instantOf({ month, day, time }: SeedDate, seeded: EventsMonth, zone: EventsTimeZone): number {
  const date = { ...shiftEventsMonth(seeded, month), day }
  if (time === undefined) return zone.startOfDay(date)
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return zone.at(date, hours * 60 + minutes)
}
