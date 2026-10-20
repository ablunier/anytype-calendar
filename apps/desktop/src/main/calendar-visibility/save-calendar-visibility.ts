import type { CalendarVisibilitySnapshot } from '@shared/ipc'
import type { AppConfigStore } from '../app-config-file'
import { CALENDAR_VISIBILITY_SECTION } from './load-calendar-visibility'
import type { CalendarVisibilityStore } from './calendar-visibility-store'

export interface SaveCalendarVisibilityDeps {
  config: AppConfigStore
  store: CalendarVisibilityStore
}

/** Written before it is shown, like the theme: the app never draws what a restart would lose. */
export class SaveCalendarVisibility {
  readonly #config: AppConfigStore
  readonly #store: CalendarVisibilityStore

  constructor({ config, store }: SaveCalendarVisibilityDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(visibility: CalendarVisibilitySnapshot): Promise<void> {
    await this.#config.writeSection(CALENDAR_VISIBILITY_SECTION, visibility)
    this.#store.set(visibility)
  }
}
