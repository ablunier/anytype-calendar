import type { AppConfigStore } from '../app-config-file'
import type { ApiVersionPreference, ApiVersionStore } from './api-version-store'
import { API_VERSION_SECTION } from './load-api-version'

export interface SaveApiVersionDeps {
  config: AppConfigStore
  store: ApiVersionStore
}

/** Written before it takes effect, like the theme: the app never reads through what a restart would lose. */
export class SaveApiVersion {
  readonly #config: AppConfigStore
  readonly #store: ApiVersionStore

  constructor({ config, store }: SaveApiVersionDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(preference: ApiVersionPreference): Promise<void> {
    await this.#config.writeSection(API_VERSION_SECTION, preference)
    this.#store.set(preference)
  }
}
