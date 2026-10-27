/** Anytype's ten colour names, the ones type icons use, so a feed is drawn in one of their hues. */
export const FEEDS_COLOURS = [
  'grey',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'blue',
  'ice',
  'teal',
  'lime'
] as const

export type FeedsColour = (typeof FEEDS_COLOURS)[number]

/** The order new subscriptions take their colour in: distinct hues first, grey last. */
const NEW_COLOURS: readonly FeedsColour[] = [
  'blue',
  'teal',
  'purple',
  'orange',
  'pink',
  'lime',
  'ice',
  'red',
  'yellow',
  'grey'
]

const MAX_NAME_LENGTH = 200

/** An external calendar the user subscribed to by its iCalendar address. */
export interface FeedsSubscription {
  /** Ours, not the feed's: random hex, so it is safe in a file name. */
  id: string
  name: string
  /**
   * `http` or `https`. A secret ICS address reads the whole calendar to anyone who holds it, so
   * it is a credential: it is stored encrypted and never leaves main.
   */
  url: string
  colour: FeedsColour
}

export function isFeedsColour(value: unknown): value is FeedsColour {
  return typeof value === 'string' && (FEEDS_COLOURS as readonly string[]).includes(value)
}

/** The first colour no subscription has yet, or, once all ten are taken, the next in turn. */
export function nextFeedsColour(taken: readonly FeedsColour[]): FeedsColour {
  return (
    NEW_COLOURS.find((colour) => !taken.includes(colour)) ??
    NEW_COLOURS[taken.length % NEW_COLOURS.length] ??
    'blue'
  )
}

/**
 * The address to read, or null when `input` is not one. `webcal://`, which calendar apps
 * publish feeds under, is read as `https://`.
 */
export function toFeedsUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const match = /^(webcals?|https?):\/\/([^/?#\s]+)([^\s]*)$/i.exec(input.trim())
  if (!match) return null
  const [, scheme = '', authority = '', rest = ''] = match
  const host = hostOf(authority)
  if (host === '' || host.startsWith(':')) return null
  const read = scheme.toLowerCase() === 'http' ? 'http' : 'https'
  return `${read}://${authority}${rest}`
}

/** What the user is shown of an address: its host, never the path or credentials that make it secret. */
export function feedsUrlHost(url: string): string {
  return hostOf(/^[a-z]+:\/\/([^/?#]*)/i.exec(url)?.[1] ?? '')
}

/** Null unless `value` is a name with something besides spaces in it; kept trimmed. */
export function toFeedsName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name === '' || name.length > MAX_NAME_LENGTH ? null : name
}

/** Without any `user:password@`, and lowercased, as hosts compare. */
function hostOf(authority: string): string {
  return authority.slice(authority.lastIndexOf('@') + 1).toLowerCase()
}
