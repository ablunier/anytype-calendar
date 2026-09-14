import {
  shiftEventsMonth,
  type EventsGateway,
  type EventsGatewayResult,
  type EventsMonth,
  type EventsObjectRef,
  type EventsSource,
  type EventsTimeZone
} from '../../domain'

export interface InMemoryEventsObject {
  id: string
  spaceId: string
  typeKey: string
  title: string
  /** Epoch milliseconds by property key. */
  dates: Record<string, number>
}

export interface InMemoryEventsGatewayOptions {
  sleep: (ms: number) => Promise<void>
  zone: EventsTimeZone
  now: () => number
  /** Defaults to inMemoryEventsSample around the month `now` falls in. */
  objects?: InMemoryEventsObject[]
  requestLatencyMs?: number
}

/** A date `month` months from the seeded month, and `time` as `HH:MM` for a timed one. */
interface SeedDate {
  month: number
  day: number
  time?: string
}

type Seed = [title: string, spaceId: string, typeKey: string, dates: Record<string, SeedDate>]

const at = (month: number, day: number, time?: string): SeedDate =>
  time === undefined ? { month, day } : { month, day, time }

const meeting = (title: string, day: number, start: string, end: string, month = 0): Seed => [
  title,
  'sp_personal',
  'meeting',
  { start_date: at(month, day, start), end_date: at(month, day, end) }
]

/**
 * The design's sample month, keyed to IN_MEMORY_SCHEMA_SPACES' account. Days stay within 28 so
 * every month has them.
 */
const SEEDS: Seed[] = [
  meeting('Weekly planning', 2, '10:00', '11:00'),
  ['Draft API notes', 'sp_personal', 'task', { due_date: at(0, 3, '14:30') }],
  ['Docs sprint', 'sp_studio', 'project', { start_date: at(0, 4), due_date: at(0, 6) }],
  meeting('Standup', 5, '09:00', '09:30'),
  ['Ship weekly digest', 'sp_studio', 'task', { due_date: at(0, 6, '16:00') }],
  meeting('Design review', 9, '09:30', '10:15'),
  ['Rewrite empty states', 'sp_studio', 'task', { due_date: at(0, 9, '13:00') }],
  meeting('Sync with Mara', 10, '11:00', '11:45'),
  ['Field notes: local-first', 'sp_personal', 'task', { due_date: at(0, 10) }],
  ['Ship changelog', 'sp_studio', 'task', { due_date: at(0, 11, '15:00') }],
  ['Launch week', 'sp_studio', 'project', { start_date: at(0, 12), due_date: at(0, 16) }],
  meeting('Design review', 12, '09:30', '10:15'),
  ['Write release notes', 'sp_studio', 'task', { due_date: at(0, 12, '11:00') }],
  ['Reply to Iris', 'sp_personal', 'task', { due_date: at(0, 12, '14:00') }],
  ['Close the week', 'sp_personal', 'task', { due_date: at(0, 13, '17:00') }],
  ['Seeing Like a State', 'sp_reading', 'book', { start_date: at(0, 14), finish_date: at(0, 21) }],
  meeting('Weekly planning', 16, '10:00', '10:30'),
  ['Iris', 'sp_personal', 'contact', { birthday: at(0, 17) }],
  ['Sync API contract', 'sp_studio', 'task', { due_date: at(0, 18, '09:00') }],
  ['File taxes', 'sp_archive', 'task', { due_date: at(0, 19) }],
  ['Quarter close', 'sp_studio', 'project', { start_date: at(0, 20), due_date: at(0, 21) }],
  meeting('Interview: Sofia', 23, '11:30', '12:15'),
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
      { issued_on: at(month, 1), due_date: at(month, 25, '09:00') }
    ]
  )
]

/** Seeded around `month`, so the fake account always has something to show wherever it runs. */
export function inMemoryEventsSample(month: EventsMonth, zone: EventsTimeZone): InMemoryEventsObject[] {
  return SEEDS.map(([title, spaceId, typeKey, dates], index) => ({
    id: `obj_${index + 1}`,
    spaceId,
    typeKey,
    title,
    dates: Object.fromEntries(
      Object.entries(dates).map(([key, seed]) => [key, instantOf(seed, month, zone)])
    )
  }))
}

/** Simulates the Anytype local API's object search with no I/O. Accepts any key. */
export class InMemoryEventsGateway implements EventsGateway {
  readonly #sleep: (ms: number) => Promise<void>
  readonly #objects: InMemoryEventsObject[]
  readonly #requestLatencyMs: number

  constructor({ sleep, zone, now, objects, requestLatencyMs = 300 }: InMemoryEventsGatewayOptions) {
    this.#sleep = sleep
    this.#objects = objects ?? inMemoryEventsSample(zone.dayOf(now()), zone)
    this.#requestLatencyMs = requestLatencyMs
  }

  /** Returns every object of the source with a From value, as the port allows. */
  async listObjects(
    _apiKey: string,
    { spaceId, typeKey, from, to }: EventsSource
  ): Promise<EventsGatewayResult<EventsObjectRef[]>> {
    await this.#sleep(this.#requestLatencyMs)
    const refs = this.#objects.flatMap(({ id, title, dates, ...object }) => {
      const start = dates[from]
      if (object.spaceId !== spaceId || object.typeKey !== typeKey || start === undefined) return []
      return [{ id, title, start, end: to === null ? null : (dates[to] ?? null) }]
    })
    return { ok: true, value: refs }
  }
}

/** A time is added to the day's start, so on a day the clocks change it lands an hour off. */
function instantOf({ month, day, time }: SeedDate, seeded: EventsMonth, zone: EventsTimeZone): number {
  const start = zone.startOfDay({ ...shiftEventsMonth(seeded, month), day })
  if (time === undefined) return start
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return start + (hours * 60 + minutes) * 60_000
}
