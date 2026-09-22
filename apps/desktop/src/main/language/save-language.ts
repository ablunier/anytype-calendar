import type { AppConfigStore } from '../app-config-file'
import type { LanguageState, LanguageStore } from './language-store'

const SECTION = 'language'

export interface SaveLanguageDeps {
  config: AppConfigStore
  store: LanguageStore
}

/**
 * Written before it is shown, so the app never draws a language that would be gone after a
 * restart. `null` is a value worth saving too: it is how "System default" is chosen after an
 * explicit language was set.
 */
export class SaveLanguage {
  readonly #config: AppConfigStore
  readonly #store: LanguageStore

  constructor({ config, store }: SaveLanguageDeps) {
    this.#config = config
    this.#store = store
  }

  async execute(language: LanguageState): Promise<void> {
    await this.#config.writeSection(SECTION, language)
    this.#store.set(language)
  }
}
