/* What the calendar's sidebar hides. A hidden source is still read: its events are dropped
 * here, from what is drawn, so showing it again needs no request to Anytype. The pure part of
 * the sidebar, over source keys (`ObjectType.key`, which `CalendarEvent.type` carries too). */

import type { CalendarEvent, ObjectType, TypePicks } from '@renderer/types'

export type SourceVisibility = 'shown' | 'hidden' | 'mixed'

/** The chosen types and queries of the chosen spaces: what the calendar holds, and so what it can hide. */
export function sourcesOnCalendar(types: ObjectType[], picks: TypePicks): ObjectType[] {
  return types.filter((type) => picks.typeKeys.includes(type.key) && picks.spaceKeys.includes(type.space))
}

/**
 * Of the events of sources not hidden, each object once, as its lowest-ranked source places
 * it. A type ranks before a query, so one a visible query brings is still drawn when its type
 * is hidden, and as the type places it otherwise.
 */
export function visibleEvents(events: CalendarEvent[], hidden: ReadonlySet<string>): CalendarEvent[] {
  const shown = hidden.size === 0 ? events : events.filter(({ type }) => !hidden.has(type))
  const first = new Map<string, number>()
  for (const event of shown) {
    const key = objectKey(event)
    const rank = first.get(key)
    if (rank === undefined || event.rank < rank) first.set(key, event.rank)
  }
  const drawn = new Set<string>()
  return shown.filter((event) => {
    const key = objectKey(event)
    if (event.rank !== first.get(key) || drawn.has(key)) return false
    drawn.add(key)
    return true
  })
}

/** Space ids and object ids never contain a newline, so the pair cannot collide. */
function objectKey({ space, id }: CalendarEvent): string {
  return `${space}\n${id}`
}

/** Whether all, none or some of `keys` are shown; a space with no sources counts as shown. */
export function visibilityOf(keys: string[], hidden: ReadonlySet<string>): SourceVisibility {
  const hiddenCount = keys.filter((key) => hidden.has(key)).length
  if (hiddenCount === 0) return 'shown'
  return hiddenCount === keys.length ? 'hidden' : 'mixed'
}

/** `keys` all shown or all hidden, the rest of `hidden` as it was. */
export function withVisibility(hidden: ReadonlySet<string>, keys: string[], shown: boolean): string[] {
  const next = new Set(hidden)
  for (const key of keys) {
    if (shown) next.delete(key)
    else next.add(key)
  }
  return [...next]
}

/** Without the keys of sources no longer on the calendar, which a saved visibility may still name. */
export function prunedHidden(hidden: readonly string[], known: readonly string[]): string[] {
  const keep = new Set(known)
  return hidden.filter((key) => keep.has(key))
}

/** True when the calendar holds sources and every one of them is hidden. */
export function allHidden(sources: ObjectType[], hidden: ReadonlySet<string>): boolean {
  return sources.length > 0 && sources.every(({ key }) => hidden.has(key))
}
