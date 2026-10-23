import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { DateMapping, ObjectType } from '@renderer/types'
import { TypeTile } from '@renderer/components/app/TypeTile'
import { Button, Checkbox } from '@renderer/components/ui'
import { dateLabel } from '@renderer/lib/calendar'
import { TypeSettingsDialog, type TypeSettingsDialogProps } from './TypeSettingsDialog'

export type TypeSettingsHandlers = Omit<
  TypeSettingsDialogProps,
  'type' | 'open' | 'mapping' | 'details' | 'onClose'
>

export interface TypeConfigRowProps extends TypeSettingsHandlers {
  type: ObjectType
  checked: boolean
  mapping: DateMapping
  /** Whether it can pick its Done, Location and panel properties: only under v2. */
  details: boolean
  last: boolean
  onToggle: () => void
}

/**
 * One line per type or query: what it is, and a summary of how it is drawn. The settings
 * themselves are in a dialog, since there are too many to line up in columns.
 */
export function TypeConfigRow({
  type,
  checked,
  mapping,
  details,
  last,
  onToggle,
  ...handlers
}: TypeConfigRowProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <div
      className={[
        'flex items-center gap-12 py-10',
        last ? '' : 'border-b border-line-hairline'
      ].join(' ')}
    >
      <Checkbox
        checked={checked}
        swatch={type.category}
        onChange={onToggle}
        ariaLabel={t('common.showTypeObjects', { label: type.label })}
      />
      <TypeTile type={type} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 items-baseline gap-8">
          <span className="truncate type-ui text-small text-ink-primary">{type.label}</span>
          {type.query ? (
            <span className="truncate type-caption text-tiny text-ink-tertiary">
              {t('common.queryOf', { type: type.query.typeLabel })}
            </span>
          ) : null}
        </div>
        <span
          className={[
            'truncate type-caption text-tiny',
            checked ? 'text-ink-secondary' : 'text-ink-tertiary'
          ].join(' ')}
        >
          {summaryOf(type, mapping, details, t)}
        </span>
      </div>
      {/* Only a ticked type is saved, so there is nothing to set for one that is not. */}
      <Button
        variant="ghost"
        size="sm"
        iconLeft="sliders-horizontal"
        disabled={!checked}
        onClick={() => setOpen(true)}
      >
        {t('config.editType')}
      </Button>
      <TypeSettingsDialog
        type={type}
        open={open}
        mapping={mapping}
        details={details}
        onClose={() => setOpen(false)}
        {...handlers}
      />
    </div>
  )
}

/** e.g. `Start date → End date · With time · Coloured by Priority · 2 properties in the panel`. */
function summaryOf(type: ObjectType, mapping: DateMapping, details: boolean, t: TFunction): string {
  const { from, to, includesTime, colourBy, view, panel } = mapping
  const parts = [
    to === null
      ? dateLabel(type, from)
      : t('config.summaryRange', { from: dateLabel(type, from), to: dateLabel(type, to) }),
    includesTime ? t('config.summaryTimed') : t('config.summaryAllDay')
  ]
  if (type.query) {
    const viewLabel = type.query.views.find(({ key }) => key === view)?.label ?? type.query.views[0]?.label
    if (viewLabel) parts.push(t('config.summaryView', { view: viewLabel }))
  }
  const colour = type.selects.find(({ key }) => key === colourBy)?.label
  if (colour) parts.push(t('config.summaryColour', { property: colour }))
  if (details && panel.length > 0) parts.push(t('config.summaryPanel', { count: panel.length }))
  return parts.join(' · ')
}
