import type { CategoryHue, Space } from '@renderer/types'
import { catBg } from '@renderer/components/ui'

export type DotSize = 6 | 8

const sizeClass: Record<DotSize, string> = { 6: 'size-6', 8: 'size-8' }

export interface SpaceDotProps {
  space: Space
  size?: DotSize
}

/**
 * Object types and spaces are identified by a rounded colour square, not an icon —
 * icons stay reserved for actions.
 */
export function SpaceDot({ space, size = 8 }: SpaceDotProps): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={['shrink-0 rounded-2', sizeClass[size], catBg[space.category]].join(' ')}
    />
  )
}

export interface SpaceChipProps {
  label: string
  hues: CategoryHue[]
}

export function SpaceChip({ label, hues }: SpaceChipProps): React.JSX.Element {
  return (
    <span className="inline-flex h-control-sm items-center gap-6 rounded-6 border border-line-subtle bg-surface-card px-8 type-ui text-small text-ink-body">
      <span className="inline-flex gap-2" aria-hidden>
        {hues.map((hue) => (
          <span key={hue} className={['size-8 rounded-2', catBg[hue]].join(' ')} />
        ))}
      </span>
      {label}
    </span>
  )
}
