import type { AppConfigStore } from '../app-config-file'
import type { Theme, ThemeStore } from './theme-store'

const SECTION = 'theme'

export interface SaveThemeDeps {
  config: AppConfigStore
  store: ThemeStore
}

/**
 * Written before it is shown, so the app never draws a theme that would be gone after a
 * restart. Unlike a schema selection, saves need no queue of their own: they all go through
 * the same app config file, which already serializes every read and write against it.
 */
export class SaveTheme {
  readonly #config: AppConfigStore
  readonly #store: ThemeStore

  constructor({ config, store }: SaveThemeDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(theme: Theme): Promise<void> {
    await this.#config.writeSection(SECTION, theme)
    this.#store.set(theme)
  }
}
