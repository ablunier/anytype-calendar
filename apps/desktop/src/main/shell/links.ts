/** The only links handed to the OS: a web page, or a new mail or call. */
const OPENABLE_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/** Renderer input is untrusted, and an accepted link is opened by whatever the OS maps it to. */
export function isOpenableLink(link: unknown): link is string {
  if (typeof link !== 'string') return false
  try {
    return OPENABLE_PROTOCOLS.has(new URL(link).protocol)
  } catch {
    return false
  }
}
