import type { EventsSource } from '@anytype-calendar/events/domain'
import type {
  SchemaQueryChoice,
  SchemaSelectionState,
  SchemaSpace,
  SchemaSync,
  SchemaType,
  SchemaTypeChoice
} from '@anytype-calendar/schema/domain'

/**
 * Only the types and queries of chosen spaces: a selection keeps one chosen inside a space
 * since unchosen, for when the space is chosen again, but it is not drawn meanwhile. Types come
 * first, so an object a type and a query both bring is placed by the type (see LoadEventsSpan).
 *
 * Done, Location, the colour-by property and the panel's are read only where the last read of
 * the account saw the type with them — for a query, the type it runs over: v2 refuses a search
 * for a field the space lacks, so a property named without being there would hide every object
 * of the type. Before that read, each is read by its dates alone.
 */
export function eventsSourcesFor(selection: SchemaSelectionState, sync: SchemaSync): EventsSource[] {
  if (selection.phase === 'unset') return []
  const { spaceIds, types, queries } = selection.selection
  const synced = sync.phase === 'idle' ? undefined : sync.last
  const spaceOf = (spaceId: string): SchemaSpace | undefined =>
    synced?.spaces.find(({ id }) => id === spaceId)

  const typeSources = types
    .filter((choice) => spaceIds.includes(choice.spaceId))
    .map((choice) => {
      const { spaceId, typeKey, from, to, includesTime } = choice
      const source: EventsSource = { kind: 'type', spaceId, typeKey, from, to, includesTime }
      const type = spaceOf(spaceId)?.types.find(({ key }) => key === typeKey)
      return type ? withDetails(source, type, choice) : source
    })
  const querySources = queries
    .filter((choice) => spaceIds.includes(choice.spaceId))
    .map((choice) => {
      const { spaceId, queryId, viewId, from, to, includesTime } = choice
      const source: EventsSource = { kind: 'query', spaceId, queryId, viewId, from, to, includesTime }
      const space = spaceOf(spaceId)
      const typeKey = space?.queries.find(({ id }) => id === queryId)?.typeKey
      const type = space?.types.find(({ key }) => key === typeKey)
      return type ? withDetails(source, type, choice) : source
    })
  return [...typeSources, ...querySources]
}

function withDetails(
  source: EventsSource,
  type: SchemaType,
  { colourBy, panel, done, location }: SchemaTypeChoice | SchemaQueryChoice
): EventsSource {
  const detailed = { ...source }
  const checkbox = type.checkboxProperties.find(({ key }) => key === done)
  if (checkbox) detailed.done = checkbox.key
  const text = type.textProperties.find(({ key }) => key === location)
  if (text) detailed.location = text.key
  const shown = panel.flatMap((key) => type.panelProperties.filter((property) => property.key === key))
  if (shown.length > 0) {
    detailed.panel = shown.map(({ key, format, options }) =>
      options === undefined
        ? { key, format }
        : { key, format, options: options.map(({ name, color }) => ({ name, color })) }
    )
  }
  const select = type.selectProperties.find(({ key }) => key === colourBy)
  if (select) {
    detailed.colourBy = {
      key: select.key,
      options: select.options.map(({ name, color }) => ({ name, color }))
    }
  }
  return detailed
}
