import type { Space } from '@renderer/types'

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export interface SpaceMonogramProps {
  space: Space
}

/**
 * Anytype gives a space no colour, so a space is marked by its initial in neutral ink. A hue
 * here would read as one of the types' hues on the grid.
 */
export function SpaceMonogram({ space }: SpaceMonogramProps): React.JSX.Element {
  return (
    <span
      aria-hidden
      className="flex size-16 shrink-0 items-center justify-center rounded-4 border border-line-default type-ui text-micro text-ink-secondary"
    >
      {initialOf(space.name)}
    </span>
  )
}

/** By grapheme, so a name that starts with an emoji keeps the whole emoji. */
function initialOf(name: string): string {
  for (const { segment } of graphemes.segment(name.trim())) return segment.toLocaleUpperCase()
  return ''
}
