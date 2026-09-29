import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarSlot, ObjectType, Space } from '@renderer/types'
import { Button, Dialog, Input, Select } from '@renderer/components/ui'
import { longDate } from '@renderer/lib/calendar'
import { timeOfMinute } from '@renderer/lib/time-grid'

/** Where a new timed object starts when the slot it was asked for names no time: a month cell. */
const DEFAULT_MINUTE = 9 * 60

export interface CreateEventDialogProps {
  slot: CalendarSlot
  /** Never empty: the calendar only offers creating when there is a type to create. */
  types: ObjectType[]
  spacesByKey: Map<string, Space>
  onClose: () => void
  /** Resolves whether the object was created; the dialog stays open, as filled in, when not. */
  onCreate: (type: ObjectType, name: string, slot: CalendarSlot) => Promise<boolean>
}

/**
 * Names the object and picks its type; the day is the one double-clicked. A time is asked for
 * only where the type's dates carry one, starting at the slot's.
 */
export function CreateEventDialog({
  slot,
  types,
  spacesByKey,
  onClose,
  onCreate
}: CreateEventDialogProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const formId = useId()
  const [name, setName] = useState('')
  const [typeKey, setTypeKey] = useState(types[0]?.key ?? '')
  const [time, setTime] = useState(timeOfMinute(slot.minute ?? DEFAULT_MINUTE))
  const [creating, setCreating] = useState(false)
  const type = types.find(({ key }) => key === typeKey) ?? types[0]
  // A label alone would repeat when two chosen spaces each have a type of that name.
  const spaceCount = new Set(types.map(({ space }) => space)).size

  const submit = async (): Promise<void> => {
    if (!type || creating) return
    setCreating(true)
    const minute = type.includesTime ? (minuteOf(time) ?? DEFAULT_MINUTE) : null
    const created = await onCreate(type, name.trim(), { date: slot.date, minute })
    setCreating(false)
    if (created) onClose()
  }

  return (
    <Dialog
      open
      title={t('calendar.create.title')}
      description={longDate(slot.date, i18n.language)}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="md" type="submit" form={formId} loading={creating}>
            {t('calendar.create.submit')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-12"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Input
          label={t('calendar.create.name')}
          placeholder={t('common.untitled')}
          value={name}
          onChange={setName}
        />
        <Select
          label={t('calendar.create.type')}
          value={type?.key ?? ''}
          onChange={setTypeKey}
          options={types.map((option) => ({
            value: option.key,
            label:
              spaceCount > 1
                ? t('calendar.create.typeInSpace', {
                    type: option.label,
                    space: spacesByKey.get(option.space)?.name ?? ''
                  })
                : option.label
          }))}
        />
        {type?.includesTime ? (
          <Input label={t('calendar.create.time')} type="time" value={time} onChange={setTime} />
        ) : null}
      </form>
    </Dialog>
  )
}

/** Null for an input the user emptied. */
function minuteOf(time: string): number | null {
  const [hours, minutes] = time.split(':').map(Number)
  return hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes)
    ? null
    : hours * 60 + minutes
}
