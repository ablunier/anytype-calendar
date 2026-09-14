import type { EventsSource } from '@anytype-calendar/events/domain'
import type { SchemaSelectionState } from '@anytype-calendar/schema/domain'

/**
 * Only the types of chosen spaces: a selection keeps a type chosen inside a space since
 * unchosen, for when the space is chosen again, but it is not drawn meanwhile.
 */
export function eventsSourcesFor(state: SchemaSelectionState): EventsSource[] {
  if (state.phase === 'unset') return []
  const { spaceIds, types } = state.selection
  return types
    .filter((choice) => spaceIds.includes(choice.spaceId))
    .map(({ spaceId, typeKey, from, to, includesTime }) => ({
      spaceId,
      typeKey,
      from,
      to,
      includesTime
    }))
}
