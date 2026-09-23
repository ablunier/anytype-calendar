import type { AppConfigStore } from '../app-config-file'
import {
  DEFAULT_CALENDAR_VIEW,
  toCalendarView,
  type CalendarViewStore
} from './calendar-view-store'

export const CALENDAR_VIEW_SECTION = 'calendarView'

export interface LoadCalendarViewDeps {
  config: AppConfigStore
  store: CalendarViewStore
}

export class LoadCalendarView {
  readonly #config: AppConfigStore
  readonly #store: CalendarViewStore

  constructor({ config, store }: LoadCalendarViewDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(): Promise<void> {
    this.#store.set(
      toCalendarView(await this.#config.readSection(CALENDAR_VIEW_SECTION)) ?? DEFAULT_CALENDAR_VIEW
    )
  }
}
