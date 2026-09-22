import type { AppConfigStore } from '../app-config-file'
import { toLanguage, type LanguageStore } from './language-store'

const SECTION = 'language'

export interface LoadLanguageDeps {
  config: AppConfigStore
  store: LanguageStore
}

export class LoadLanguage {
  readonly #config: AppConfigStore
  readonly #store: LanguageStore

  constructor({ config, store }: LoadLanguageDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(): Promise<void> {
    // A corrupted section falls back to "follow the OS" rather than failing startup.
    this.#store.set(toLanguage(await this.#config.readSection(SECTION)) ?? null)
  }
}
