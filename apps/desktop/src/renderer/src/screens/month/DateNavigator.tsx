import type { Space } from '@renderer/types'
import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
import { Badge, Button, IconButton, Tooltip } from '@renderer/components/ui'

export interface DateNavigatorProps {
  title: string
  subtitle: string
  legendSpaces: Space[]
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function DateNavigator({
  title,
  subtitle,
  legendSpaces,
  onPrev,
  onNext,
  onToday
}: DateNavigatorProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-16 border-b border-line-subtle bg-surface-card px-16 py-10">
      <div className="flex items-center gap-2">
        <IconButton icon="chevron-left" label="Previous month" onClick={onPrev} />
        <IconButton icon="chevron-right" label="Next month" onClick={onNext} />
      </div>

      <div className="flex min-w-0 shrink-0 items-baseline gap-8">
        <h1 className="whitespace-nowrap type-heading text-h4 text-ink-primary">{title}</h1>
        <span className="whitespace-nowrap font-mono text-tiny text-ink-tertiary">{subtitle}</span>
      </div>

      <Button size="sm" iconLeft="calendar-check" onClick={onToday}>
        Today
      </Button>

      <div className="flex-1" />

      {/* The legend is the one part of this row that may be trimmed: without min-w-0 it
          refuses to shrink and pushes the whole app into a horizontal scroll. */}
      <div className="flex min-w-0 items-center gap-16">
        <ul className="flex min-w-0 list-none items-center gap-12 overflow-hidden p-0">
          {legendSpaces.map((space) => (
            <li
              key={space.key}
              className="flex shrink-0 items-center gap-6 type-caption text-tiny text-ink-secondary"
            >
              <SpaceMonogram space={space} />
              {space.name}
            </li>
          ))}
        </ul>
        <span className="shrink-0">
          <Tooltip label="MVP: month view only, no editing" side="bottom" align="end">
            <Badge tone="neutral" icon="eye">
              Read-only
            </Badge>
          </Tooltip>
        </span>
      </div>
    </div>
  )
}
