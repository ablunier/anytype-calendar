import type { EventsSource } from '@anytype-calendar/events/domain'
import {
  SCHEMA_DONE_KEY,
  SCHEMA_LOCATION_KEY,
  type SchemaSelectionState,
  type SchemaSpace,
  type SchemaSync,
  type SchemaType
} from '@anytype-calendar/schema/domain'

/**
 * Only the types and queries of chosen spaces: a selection keeps one chosen inside a space
 * since unchosen, for when the space is chosen again, but it is not drawn meanwhile. Types come
 * first, so an object a type and a query both bring is placed by the type (see LoadEventsSpan).
 *
 * Done, Location and the colour-by property are read only where the last read of the account
 * saw the type with them — for a query, the type it runs over: v2 refuses a search for a field
 * the type lacks, so a property named without being there would hide every object of the type.
 * Before that read, each is read by its dates alone.
 */
export function eventsSourcesFor(selection: SchemaSelectionState, sync: SchemaSync): EventsSource[] {
  if (selection.phase === 'unset') return []
  const { spaceIds, types, queries } = selection.selection
  const synced = sync.phase === 'idle' ? undefined : sync.last
  const spaceOf = (spaceId: string): SchemaSpace | undefined =>
    synced?.spaces.find(({ id }) => id === spaceId)

  const typeSources = types
    .filter((choice) => spaceIds.includes(choice.spaceId))
    .map(({ spaceId, typeKey, from, to, includesTime, colourBy }) => {
      const source: EventsSource = { kind: 'type', spaceId, typeKey, from, to, includesTime }
      const type = spaceOf(spaceId)?.types.find(({ key }) => key === typeKey)
      return type ? withDetails(source, type, colourBy) : source
    })
  const querySources = queries
    .filter((choice) => spaceIds.includes(choice.spaceId))
    .map(({ spaceId, queryId, viewId, from, to, includesTime, colourBy }) => {
      const source: EventsSource = { kind: 'query', spaceId, queryId, viewId, from, to, includesTime }
      const space = spaceOf(spaceId)
      const typeKey = space?.queries.find(({ id }) => id === queryId)?.typeKey
      const type = space?.types.find(({ key }) => key === typeKey)
      return type ? withDetails(source, type, colourBy) : source
    })
  return [...typeSources, ...querySources]
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
