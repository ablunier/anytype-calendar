import type { AppConfigStore } from "../app-config-file";
import { TIME_FORMAT_SECTION } from "./load-time-format";
import type { TimeFormat, TimeFormatStore } from "./time-format-store";

export interface SaveTimeFormatDeps {
  config: AppConfigStore;
  store: TimeFormatStore;
}

/** Written before it is shown, like the theme: the app never draws what a restart would lose. */
export class SaveTimeFormat {
  readonly #config: AppConfigStore;
  readonly #store: TimeFormatStore;

  constructor({ config, store }: SaveTimeFormatDeps) {
    this.#config = config;
    this.#store = store;
  }

  async execute(format: TimeFormat): Promise<void> {
    await this.#config.writeSection(TIME_FORMAT_SECTION, format);
    this.#store.set(format);
  }
}
