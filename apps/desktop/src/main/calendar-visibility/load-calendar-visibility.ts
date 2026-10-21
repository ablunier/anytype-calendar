import type { AppConfigStore } from '../app-config-file'
import {
  SHOWING_EVERYTHING,
  toCalendarVisibility,
  type CalendarVisibilityStore
} from './calendar-visibility-store'

export const CALENDAR_VISIBILITY_SECTION = 'calendarVisibility'

export interface LoadCalendarVisibilityDeps {
  config: AppConfigStore
  store: CalendarVisibilityStore
}

export class LoadCalendarVisibility {
  readonly #config: AppConfigStore
  readonly #store: CalendarVisibilityStore

  constructor({ config, store }: LoadCalendarVisibilityDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(): Promise<void> {
    this.#store.set(
      toCalendarVisibility(await this.#config.readSection(CALENDAR_VISIBILITY_SECTION)) ??
        SHOWING_EVERYTHING
    )
  }
}
