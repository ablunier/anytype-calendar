import type { AppConfigStore } from "../app-config-file";
import { WEEK_START_SECTION } from "./load-week-start";
import type { WeekStartStore } from "./week-start-store";

export interface SaveWeekStartDeps {
  config: AppConfigStore;
  store: WeekStartStore;
}

/** Written before it is shown, like the theme: the app never draws what a restart would lose. */
export class SaveWeekStart {
  readonly #config: AppConfigStore;
  readonly #store: WeekStartStore;

  constructor({ config, store }: SaveWeekStartDeps) {
    this.#config = config;
    this.#store = store;
  }

  async execute(day: number): Promise<void> {
    await this.#config.writeSection(WEEK_START_SECTION, day);
    this.#store.set(day);
  }
}
