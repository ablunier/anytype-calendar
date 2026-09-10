import type { ObjectType } from '../../types'
import { catBgSoft, catText, Icon } from '../ui'

export type TypeTileSize = 'sm' | 'md'

const boxClass: Record<TypeTileSize, string> = { sm: 'size-control-sm', md: 'size-30' }

export interface TypeTileProps {
  type: ObjectType
  size?: TypeTileSize
}

/** The washed, rounded tile that carries an object type's icon. */
export function TypeTile({ type, size = 'md' }: TypeTileProps): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={[
        'flex shrink-0 items-center justify-center rounded-8',
        boxClass[size],
        catBgSoft[type.category],
        catText[type.category]
      ].join(' ')}
    >
      <Icon name={type.icon} size={16} />
    </span>
  )
}
