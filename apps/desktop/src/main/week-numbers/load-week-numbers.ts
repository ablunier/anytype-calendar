import type { AppConfigStore } from '../app-config-file'
import { toWeekNumbers, type WeekNumbersStore } from './week-numbers-store'

export const WEEK_NUMBERS_SECTION = 'weekNumbers'

export interface LoadWeekNumbersDeps {
  config: AppConfigStore
  store: WeekNumbersStore
}

export class LoadWeekNumbers {
  readonly #config: AppConfigStore
  readonly #store: WeekNumbersStore

  constructor({ config, store }: LoadWeekNumbersDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(): Promise<void> {
    this.#store.set(toWeekNumbers(await this.#config.readSection(WEEK_NUMBERS_SECTION)) ?? false)
  }
}
