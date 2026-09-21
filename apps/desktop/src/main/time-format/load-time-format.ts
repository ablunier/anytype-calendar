import type { AppConfigStore } from "../app-config-file";
import {
  DEFAULT_TIME_FORMAT,
  toTimeFormat,
  type TimeFormatStore,
} from "./time-format-store";

export const TIME_FORMAT_SECTION = "timeFormat";

export interface LoadTimeFormatDeps {
  config: AppConfigStore;
  store: TimeFormatStore;
}

export class LoadTimeFormat {
  readonly #config: AppConfigStore;
  readonly #store: TimeFormatStore;

  constructor({ config, store }: LoadTimeFormatDeps) {
    this.#config = config;
    this.#store = store;
  }

  async execute(): Promise<void> {
    this.#store.set(
      toTimeFormat(await this.#config.readSection(TIME_FORMAT_SECTION)) ??
        DEFAULT_TIME_FORMAT,
    );
  }
}
