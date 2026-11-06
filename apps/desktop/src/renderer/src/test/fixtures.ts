import type { ObjectType } from '@renderer/types'

/**
 * A type of `space` keyed as main keys it, `space:typeKey`, with a Start date and an End date,
 * drawn all day by them.
 */
export function objectType(
  space: string,
  typeKey: string,
  label: string,
  overrides: Partial<ObjectType> = {},
): ObjectType {
  return {
    key: `${space}:${typeKey}`,
    space,
    label,
    category: 'sage',
    icon: 'calendar',
    props: [
      { key: 'start_date', label: 'Start date' },
      { key: 'end_date', label: 'End date' },
    ],
    selects: [],
    checkboxes: [],
    texts: [],
    panelProps: [],
    from: 'start_date',
    to: 'end_date',
    includesTime: false,
    colourBy: null,
    panel: [],
    done: null,
    location: null,
    ...overrides,
  }
}
