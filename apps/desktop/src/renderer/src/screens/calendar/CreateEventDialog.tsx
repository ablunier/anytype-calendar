import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { CalendarSlot, Collection, CollectionHint, ObjectType, Space } from '@renderer/types'
import { Button, Combobox, Dialog, Input, Select, type ComboboxOption } from '@renderer/components/ui'
import { longDate } from '@renderer/lib/calendar'
import { localDate } from '@renderer/lib/events'
import { collectionChoices, collectionPicksFor } from '@renderer/lib/schema'
import { timeOfMinute } from '@renderer/lib/time-grid'

/** Where a new timed object starts when the slot it was asked for names no time: a month cell. */
const DEFAULT_MINUTE = 9 * 60

export interface CreateEventDialogProps {
  slot: CalendarSlot
  /** Never empty: the calendar only offers creating when there is a type to create. */
  types: ObjectType[]
  spacesByKey: Map<string, Space>
  /** By space key; a space with none, as every space under v1, offers no Collection field. */
  collectionsBySpace: Map<string, Collection[]>
  onClose: () => void
  /**
   * Resolves whether the object was created; the dialog stays open, as filled in, when not.
   * `collectionId` is null for None.
   */
  onCreate: (type: ObjectType, name: string, slot: CalendarSlot, collectionId: string | null) => Promise<boolean>
}

/**
 * Names the object and picks its type; the day is the one double-clicked. A time is asked for
 * only where the type's dates carry one, starting at the slot's, and a collection to add it to
 * only where the type's space has some. A type in another space puts the collection back to
 * None; one in the same space keeps it.
 */
export function CreateEventDialog({
  slot,
  types,
  spacesByKey,
  collectionsBySpace,
  onClose,
  onCreate
}: CreateEventDialogProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const formId = useId()
  const [name, setName] = useState('')
  const [typeKey, setTypeKey] = useState(types[0]?.key ?? '')
  const [time, setTime] = useState(timeOfMinute(slot.minute ?? DEFAULT_MINUTE))
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const type = types.find(({ key }) => key === typeKey) ?? types[0]
  const choices = collectionChoices((type && collectionsBySpace.get(type.space)) ?? [])
  // A label alone would repeat when two chosen spaces each have a type of that name.
  const spaceCount = new Set(types.map(({ space }) => space)).size

  const submit = async (): Promise<void> => {
    if (!type || creating) return
    setCreating(true)
    const minute = type.includesTime ? (minuteOf(time) ?? DEFAULT_MINUTE) : null
    const created = await onCreate(type, name.trim(), { date: slot.date, minute }, collectionId)
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
          onChange={(key) => {
            if (types.find((option) => option.key === key)?.space !== type?.space) setCollectionId(null)
            setTypeKey(key)
          }}
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
        {choices.length > 0 ? (
          <Combobox
            label={t('calendar.create.collection')}
            value={collectionId ?? ''}
            onChange={(value) => setCollectionId(value === '' ? null : value)}
            noMatchText={t('calendar.create.noCollectionMatch')}
            optionsFor={(query) =>
              collectionPicksFor(choices, query).map(
                (pick): ComboboxOption =>
                  pick.kind === 'none'
                    ? { value: '', label: t('calendar.create.noCollection'), pinned: true }
                    : {
                        value: pick.collection.key,
                        label: pick.collection.name || t('common.untitled'),
                        detail: hintText(t, pick.hint, i18n.language) ?? undefined
                      }
              )
            }
          />
        ) : null}
        {type?.includesTime ? (
          <Input label={t('calendar.create.time')} type="time" value={time} onChange={setTime} />
        ) : null}
      </form>
    </Dialog>
  )
}

/** What tells a collection apart from the others of its name, as the list shows it. */
function hintText(t: TFunction, hint: CollectionHint, locale: string): string | null {
  if (hint === null) return null
  if (hint.kind === 'modified') {
    return t('calendar.create.collectionModified', { date: longDate(localDate(hint.at), locale) })
  }
  const names = hint.names.join(', ')
  return hint.more === 0 ? names : t('calendar.create.collectionBacklinksMore', { names, more: hint.more })
}

/** Null for an input the user emptied. */
function minuteOf(time: string): number | null {
  const [hours, minutes] = time.split(':').map(Number)
  return hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes)
    ? null
    : hours * 60 + minutes
}
