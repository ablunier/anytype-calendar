/** The formats the detail panel draws a property in. */
export type EventsDetailFormat =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'url'
  | 'email'
  | 'phone'
  | 'objects'

/** `color` is Anytype's own colour name. */
export interface EventsOption {
  name: string
  color: string
}

/** A property a source's objects show in the detail panel, as the user chose. */
export interface EventsPanelProperty {
  key: string
  format: EventsDetailFormat
  /** A select's or multi-select's: a value naming none of them is not shown. */
  options?: EventsOption[]
}

/** An object, or a space member, that a property links to. */
export interface EventsLinkedObject {
  /** Anytype's object id; a member's is `participant-<identity>`. */
  id: string
  name: string
  /** Members cannot be opened as objects. */
  member: boolean
}

/** A panel property's value, as drawn. Never empty: a property with no value has none. */
export type EventsDetail =
  | { key: string; format: 'text' | 'url' | 'email' | 'phone'; value: string }
  | { key: string; format: 'number'; value: number }
  | { key: string; format: 'select' | 'multi_select'; options: EventsOption[] }
  | { key: string; format: 'objects'; objects: EventsLinkedObject[] }

/** A panel property's value as an object row gives it: options by name, linked objects by id. */
export type EventsDetailRef =
  | Extract<EventsDetail, { format: 'text' | 'url' | 'email' | 'phone' | 'number' }>
  | { key: string; format: 'select' | 'multi_select'; names: string[] }
  | { key: string; format: 'objects'; ids: string[] }

/** The ids `refs` link to, each once. */
export function linkedEventsIds(refs: readonly EventsDetailRef[]): string[] {
  return [...new Set(refs.flatMap((ref) => (ref.format === 'objects' ? ref.ids : [])))]
}

/**
 * In the panel's order. An option the property does not have — a deleted one is named by its
 * object id instead — is left out, as is a linked object `linked` cannot name; a property left
 * with no value is left out altogether.
 */
export function toEventsDetails(
  refs: readonly EventsDetailRef[],
  panel: readonly EventsPanelProperty[],
  linked: (id: string) => EventsLinkedObject | undefined
): EventsDetail[] {
  return panel.flatMap(({ key, format, options = [] }): EventsDetail[] => {
    const ref = refs.find((candidate) => candidate.key === key && candidate.format === format)
    if (!ref) return []
    switch (ref.format) {
      case 'select':
      case 'multi_select': {
        const named = ref.names.flatMap((name) => options.filter((option) => option.name === name))
        return named.length === 0 ? [] : [{ key, format: ref.format, options: named }]
      }
      case 'objects': {
        const objects = ref.ids.flatMap((id) => linked(id) ?? [])
        return objects.length === 0 ? [] : [{ key, format: ref.format, objects }]
      }
      default:
        return [ref]
    }
  })
}
