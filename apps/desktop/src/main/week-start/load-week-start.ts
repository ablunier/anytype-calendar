import type { AppConfigStore } from "../app-config-file";
import {
  DEFAULT_WEEK_START,
  toWeekStart,
  type WeekStartStore,
} from "./week-start-store";

export const WEEK_START_SECTION = "weekStart";

export interface LoadWeekStartDeps {
  config: AppConfigStore;
  store: WeekStartStore;
}

export class LoadWeekStart {
  readonly #config: AppConfigStore;
  readonly #store: WeekStartStore;

  constructor({ config, store }: LoadWeekStartDeps) {
    this.#config = config;
    this.#store = store;
  }

  async execute(): Promise<void> {
    this.#store.set(
      toWeekStart(await this.#config.readSection(WEEK_START_SECTION)) ??
        DEFAULT_WEEK_START,
    );
  }
}
