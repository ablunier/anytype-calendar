import type { AppConfigStore } from '../app-config-file'
import { WEEK_NUMBERS_SECTION } from './load-week-numbers'
import type { WeekNumbersStore } from './week-numbers-store'

export interface SaveWeekNumbersDeps {
  config: AppConfigStore
  store: WeekNumbersStore
}

/** Written before it is shown, like the theme: the app never draws what a restart would lose. */
export class SaveWeekNumbers {
  readonly #config: AppConfigStore
  readonly #store: WeekNumbersStore

  constructor({ config, store }: SaveWeekNumbersDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(shown: boolean): Promise<void> {
    await this.#config.writeSection(WEEK_NUMBERS_SECTION, shown)
    this.#store.set(shown)
  }
}
