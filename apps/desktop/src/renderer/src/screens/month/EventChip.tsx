import type { CategoryHue } from '../../types'
import { catBg, catBgSoft, catText } from '../../components/ui'

export interface EventChipProps {
  title: string
  category: CategoryHue
  time?: string
  allDay?: boolean
  done?: boolean
  onClick: () => void
}

/**
 * One dated Anytype object inside a day cell.
 *
 * A real <button>, not the design's role="button" div, so it is tabbable and fires on
 * Enter and Space. Stops propagation so opening an object does not also select the day.
 */
export function EventChip({
  title,
  category,
  time,
  allDay = false,
  done = false,
  onClick
}: EventChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={[
        'flex min-h-20 w-full items-center gap-6 rounded-chip border border-transparent px-6 py-2',
        'text-left transition-shadow duration-fast ease-standard hover:shadow-1',
        allDay ? `${catBg[category]} text-stone-000` : `${catBgSoft[category]} ${catText[category]}`,
        done ? 'opacity-55' : ''
      ].join(' ')}
    >
      {!allDay ? (
        <span aria-hidden className={['size-5 shrink-0 rounded-pill', catBg[category]].join(' ')} />
      ) : null}
      {time ? (
        <span className="font-mono text-micro tracking-mono opacity-85">{time}</span>
      ) : null}
      <span
        className={[
          'min-w-0 flex-1 truncate type-ui text-tiny',
          done ? 'line-through' : ''
        ].join(' ')}
      >
        {title}
      </span>
    </button>
  )
}
