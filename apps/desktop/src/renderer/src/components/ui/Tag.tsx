import type { ReactNode } from 'react'
import type { CategoryHue, IconName } from '../../types'
import { catBgSoft, catText } from './category'
import { Icon } from './Icon'

export interface TagProps {
  children: ReactNode
  category?: CategoryHue
  icon?: IconName
}

/** Category chip for Anytype object types, relations and user labels. */
export function Tag({ children, category = 'graphite', icon }: TagProps): React.JSX.Element {
  return (
    <span
      className={[
        'inline-flex h-22 items-center gap-4 rounded-chip border border-transparent px-8',
        'type-caption text-tiny font-medium',
        catBgSoft[category],
        catText[category]
      ].join(' ')}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}
