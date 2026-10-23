import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { DateMapping, ObjectType } from '@renderer/types'
import { Button, Checkbox, Dialog, Select } from '@renderer/components/ui'
import { colourOptions, dateOptions, doneOptions, locationOptions, viewOptions } from '@renderer/lib/calendar'
import { PanelPropertyList } from './PanelPropertyList'

export interface TypeSettingsDialogProps {
  type: ObjectType
  open: boolean
  mapping: DateMapping
  /**
   * Whether to offer Done, Location and the panel's properties: only v2 reads them, so under v1
   * they would change nothing.
   */
  details: boolean
  onClose: () => void
  onFromChange: (value: string) => void
  onToChange: (value: string | null) => void
  onIncludesTimeChange: (value: boolean) => void
  onColourByChange: (value: string | null) => void
  onViewChange: (value: string) => void
  onPanelChange: (value: string[]) => void
  onDoneChange: (value: string | null) => void
  onLocationChange: (value: string | null) => void
}

/** Every change is saved as it is made, like the rest of Settings, so closing it keeps them. */
export function TypeSettingsDialog({
  type,
  open,
  mapping: { from, to, includesTime, colourBy, view, panel, done, location },
  details,
  onClose,
  onFromChange,
  onToChange,
  onIncludesTimeChange,
  onColourByChange,
  onViewChange,
  onPanelChange,
  onDoneChange,
  onLocationChange
}: TypeSettingsDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  /** An empty value can never be a property key. */
  const none = { value: '', label: t('common.none') }
  const typeColour = { value: '', label: t('config.typeColour') }
  const selects = colourOptions(type)

  return (
    <Dialog
      open={open}
      width="wide"
      title={type.label}
      {...(type.query ? { description: t('common.queryOf', { type: type.query.typeLabel }) } : {})}
      onClose={onClose}
      footer={
        <Button variant="primary" size="md" onClick={onClose}>
          {t('config.typeSettingsClose')}
        </Button>
      }
    >
      <div className="flex flex-col gap-20">
        <Section title={t('config.datesSection')}>
          <div className="grid grid-cols-2 gap-12">
            <Select label={t('common.fromDate')} options={dateOptions(type)} value={from} onChange={onFromChange} />
            <Select
              label={t('common.toDateOptional')}
              options={[none, ...dateOptions(type).filter((option) => option.value !== from)]}
              value={to ?? none.value}
              onChange={(value) => onToChange(value === none.value ? null : value)}
            />
          </div>
          <Checkbox
            checked={includesTime}
            onChange={onIncludesTimeChange}
            label={t('config.includesTime')}
            description={t('config.includesTimeDescription')}
          />
        </Section>

        <Section title={t('config.appearanceSection')}>
          <div className="grid grid-cols-2 gap-12">
            {type.query ? (
              // Until one is picked, Anytype reads the first.
              <Select
                label={t('common.view')}
                options={viewOptions(type)}
                value={view ?? type.query.views[0]?.key ?? ''}
                onChange={onViewChange}
              />
            ) : null}
            <Select
              label={t('config.colour')}
              options={[typeColour, ...selects]}
              value={colourBy ?? typeColour.value}
              disabled={selects.length === 0}
              onChange={(value) => onColourByChange(value === typeColour.value ? null : value)}
            />
          </div>
          {/* Only v2 says what a select's options look like, so under v1 there is nothing to pick. */}
          {selects.length === 0 ? (
            <p className="type-caption text-tiny text-ink-tertiary">{t('config.noColourProperty')}</p>
          ) : null}
        </Section>

        {details ? (
          <Section title={t('config.panelSection')}>
            <div className="grid grid-cols-2 gap-12">
              <Select
                label={t('config.done')}
                options={[none, ...doneOptions(type)]}
                value={done ?? none.value}
                onChange={(value) => onDoneChange(value === none.value ? null : value)}
              />
              <Select
                label={t('config.location')}
                options={[none, ...locationOptions(type)]}
                value={location ?? none.value}
                onChange={(value) => onLocationChange(value === none.value ? null : value)}
              />
            </div>
            <div className="flex flex-col gap-6">
              <span className="type-ui text-small text-ink-secondary">{t('config.panelShown')}</span>
              <span className="type-caption text-tiny text-ink-tertiary">{t('config.panelDescription')}</span>
              <PanelPropertyList type={type} panel={panel} onChange={onPanelChange} />
            </div>
          </Section>
        ) : null}
      </div>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="flex flex-col gap-12">
      <h3 className="border-b border-line-hairline pb-6 type-ui text-small text-ink-primary">{title}</h3>
      {children}
    </section>
  )
}
