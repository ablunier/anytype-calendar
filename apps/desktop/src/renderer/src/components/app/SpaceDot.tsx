import type { Space } from '@renderer/types'
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
