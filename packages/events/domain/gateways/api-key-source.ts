/**
 * The key is owned by the auth context; the composition root adapts its credential store to
 * this port, so this context reads the key without depending on auth.
 */
export interface EventsApiKeySource {
  /** Null when no key is stored. */
  current(): Promise<string | null>
}
