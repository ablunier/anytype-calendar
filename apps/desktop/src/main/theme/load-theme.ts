import type { AppConfigStore } from '../app-config-file'
import { toTheme, type ThemeStore } from './theme-store'

const SECTION = 'theme'

export interface LoadThemeDeps {
  config: AppConfigStore
  store: ThemeStore
}

export class LoadTheme {
  readonly #config: AppConfigStore
  readonly #store: ThemeStore

  constructor({ config, store }: LoadThemeDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(): Promise<void> {
    this.#store.set(toTheme(await this.#config.readSection(SECTION)))
  }
}
