import type { EventsSource } from '@anytype-calendar/events/domain'
import {
  SCHEMA_DONE_KEY,
  SCHEMA_LOCATION_KEY,
  type SchemaSelectionState,
  type SchemaSync,
  type SchemaType
} from '@anytype-calendar/schema/domain'

/**
 * Only the types of chosen spaces: a selection keeps a type chosen inside a space since
 * unchosen, for when the space is chosen again, but it is not drawn meanwhile.
 *
 * Done, Location and the colour-by property are read only where the last read of the account
 * saw the type with them: v2 refuses a search for a field the type lacks, so a property named
 * without being there would hide every object of the type. Before that read, each type is read
 * by its dates alone.
 */
export function eventsSourcesFor(selection: SchemaSelectionState, sync: SchemaSync): EventsSource[] {
  if (selection.phase === 'unset') return []
  const { spaceIds, types } = selection.selection
  const synced = sync.phase === 'idle' ? undefined : sync.last
  return types
    .filter((choice) => spaceIds.includes(choice.spaceId))
    .map(({ spaceId, typeKey, from, to, includesTime, colourBy }) => {
      const source: EventsSource = { spaceId, typeKey, from, to, includesTime }
      const type = synced?.spaces
        .find(({ id }) => id === spaceId)
        ?.types.find(({ key }) => key === typeKey)
      return type ? withDetails(source, type, colourBy) : source
    })
}

function withDetails(source: EventsSource, type: SchemaType, colourBy: string | null): EventsSource {
  const detailed = { ...source }
  if (type.hasDone) detailed.done = SCHEMA_DONE_KEY
  if (type.hasLocation) detailed.location = SCHEMA_LOCATION_KEY
  const select = type.selectProperties.find(({ key }) => key === colourBy)
  if (select) {
    detailed.colourBy = {
      key: select.key,
      options: select.options.map(({ name, color }) => ({ name, color }))
    }
  }
  return detailed
}
