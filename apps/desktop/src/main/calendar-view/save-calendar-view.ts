import type { AppConfigStore } from '../app-config-file'
import { CALENDAR_VIEW_SECTION } from './load-calendar-view'
import type { CalendarView, CalendarViewStore } from './calendar-view-store'

export interface SaveCalendarViewDeps {
  config: AppConfigStore
  store: CalendarViewStore
}

/** Written before it is shown, like the theme: the app never draws what a restart would lose. */
export class SaveCalendarView {
  readonly #config: AppConfigStore
  readonly #store: CalendarViewStore

  constructor({ config, store }: SaveCalendarViewDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(view: CalendarView): Promise<void> {
    await this.#config.writeSection(CALENDAR_VIEW_SECTION, view)
    this.#store.set(view)
  }
}
