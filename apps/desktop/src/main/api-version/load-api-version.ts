import type { AppConfigStore } from '../app-config-file'
import { DEFAULT_API_VERSION, toApiVersion, type ApiVersionStore } from './api-version-store'

export const API_VERSION_SECTION = 'apiVersion'

export interface LoadApiVersionDeps {
  config: AppConfigStore
  store: ApiVersionStore
}

export class LoadApiVersion {
  readonly #config: AppConfigStore
  readonly #store: ApiVersionStore

  constructor({ config, store }: LoadApiVersionDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(): Promise<void> {
    this.#store.set(
      toApiVersion(await this.#config.readSection(API_VERSION_SECTION)) ?? DEFAULT_API_VERSION
    )
  }
}
