import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FEEDS_COLOURS, isFeedsColour, nextFeedsColour, type FeedsColour } from '@anytype-calendar/feeds/domain'
import type { FeedsAddResult, FeedsEditRequest, FeedsEditResult } from '@shared/ipc'
import type { FeedSource } from '@renderer/types'
import { Button, Card, catBg, Icon, IconButton, Input } from '@renderer/components/ui'
import { feedFailureText, feedStatusText } from '@renderer/lib/feed-text'
import { movedOrder } from '@renderer/lib/feeds'
import { hueOf } from '@renderer/lib/schema'

export interface CalendarsSectionProps {
  /** In the user's order: the sidebar's, and the order events sharing a slot are drawn in. */
  feeds: FeedSource[]
  /** Resolves why the feed was refused, or rejects when it could not be saved. */
  onAdd: (url: string, name: string, colour: FeedsColour) => Promise<FeedsAddResult>
  /** Resolves why a new address was refused, or rejects when the edit could not be saved. */
  onEdit: (request: FeedsEditRequest) => Promise<FeedsEditResult>
  onRemove: (id: string) => Promise<void>
  onReorder: (ids: string[]) => Promise<void>
  onRefresh: () => void
  /** Scrolls to the section and focuses the address to add, e.g. when the sidebar's plus opened Settings. */
  focusAdd?: boolean
}

/**
 * External calendars, subscribed to by their iCalendar address: Google's secret address in
 * iCal format, Outlook's published link, iCloud's public calendar, a holiday feed. Each is
 * read-only. They are put in order by dragging them, or with the arrows beside each, which a
 * keyboard reaches too.
 */
export function CalendarsSection({
  feeds,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
  onRefresh,
  focusAdd = false
}: CalendarsSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  // A change already sent, so a failed one can say so; main pushes the list back once saved.
  const run = (change: Promise<void>): void => {
    change.then(
      () => setFailed(false),
      () => setFailed(true)
    )
  }

  const [dragging, setDragging] = useState<string | null>(null)
  const [order, setOrder] = useState<string[] | null>(null)
  const ids = order ?? feeds.map(({ id }) => id)
  const byId = new Map(feeds.map((feed) => [feed.id, feed]))
  const shown = ids.flatMap((id) => byId.get(id) ?? [])

  const dragOver = (event: DragEvent, id: string): void => {
    if (dragging === null) return
    event.preventDefault()
    const from = ids.indexOf(dragging)
    const to = ids.indexOf(id)
    if (from !== -1 && to !== -1 && from !== to) setOrder(movedOrder(ids, from, to))
  }
  const endDrag = (dropped: boolean): void => {
    if (dropped && order !== null) run(onReorder(order))
    setDragging(null)
    setOrder(null)
  }
  const move = (index: number, delta: number): void =>
    run(onReorder(movedOrder(feeds.map(({ id }) => id), index, index + delta)))

  return (
    <section>
      <div className="mb-10 flex items-baseline gap-8">
        <h2 className="type-heading text-h4 text-ink-primary">{t('feeds.heading')}</h2>
        <span className="type-caption text-tiny text-ink-tertiary">{t('feeds.description')}</span>
        <div className="flex-1" />
        {feeds.length > 0 ? (
          <Button variant="ghost" size="sm" iconLeft="refresh-cw" onClick={onRefresh}>
            {t('feeds.readAll')}
          </Button>
        ) : null}
      </div>
      <Card className="flex flex-col gap-16">
        {shown.length > 0 ? (
          <ul aria-label={t('feeds.listLabel')} className="m-0 flex list-none flex-col gap-4 p-0">
            {shown.map((feed, index) => (
              <FeedRow
                key={feed.id}
                feed={feed}
                first={index === 0}
                last={index === shown.length - 1}
                lifted={dragging === feed.id}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  setDragging(feed.id)
                }}
                onDragOver={(event) => dragOver(event, feed.id)}
                onDrop={(event) => {
                  event.preventDefault()
                  endDrag(true)
                }}
                onDragEnd={() => endDrag(false)}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                onEdit={onEdit}
                onRemove={() => run(onRemove(feed.id))}
              />
            ))}
          </ul>
        ) : (
          <p className="m-0 type-body text-small text-ink-secondary">{t('feeds.none')}</p>
        )}
        {failed ? (
          <span className="flex items-center gap-6 type-caption text-tiny text-ink-danger">
            <Icon name="circle-alert" size={12} />
            {t('feeds.changeFailed')}
          </span>
        ) : null}
        <AddFeedForm
          onAdd={onAdd}
          taken={feeds.flatMap(({ colour }) => (isFeedsColour(colour) ? [colour] : []))}
          focus={focusAdd}
        />
      </Card>
    </section>
  )
}

interface FeedRowProps {
  feed: FeedSource
  first: boolean
  last: boolean
  lifted: boolean
  onDragStart: (event: DragEvent) => void
  onDragOver: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
  onDragEnd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: (request: FeedsEditRequest) => Promise<FeedsEditResult>
  onRemove: () => void
}

function FeedRow({
  feed,
  first,
  last,
  lifted,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onEdit,
  onRemove
}: FeedRowProps): React.JSX.Element {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const failed = feed.status.failure !== undefined && feed.status.state !== 'syncing'

  if (editing) {
    return (
      <li className="rounded-8 border border-line-subtle p-12">
        <FeedEditor
          feed={feed}
          onCancel={() => setEditing(false)}
          onSave={async (request) => {
            const result = await onEdit(request)
            if (result.ok) setEditing(false)
            return result
          }}
        />
      </li>
    )
  }

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={[
        'flex items-center gap-10 rounded-8 px-8 py-6 hover:bg-surface-hover',
        lifted ? 'opacity-50' : ''
      ].join(' ')}
    >
      <Icon name="ellipsis" size={14} className="shrink-0 cursor-grab text-ink-tertiary" />
      <span aria-hidden className={['size-12 shrink-0 rounded-pill', catBg[feed.category]].join(' ')} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-ui text-small text-ink-primary">{feed.name}</span>
        <span
          className={[
            'truncate type-caption text-tiny',
            failed ? 'text-ink-danger' : 'text-ink-tertiary'
          ].join(' ')}
        >
          {feed.host} · {feedStatusText(t, feed.status)}
        </span>
      </div>
      {confirming ? (
        <>
          <span className="type-caption text-tiny text-ink-secondary">{t('feeds.removeConfirm')}</span>
          <Button variant="danger" size="sm" onClick={onRemove}>
            {t('feeds.remove')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </Button>
        </>
      ) : (
        <>
          <IconButton
            size="sm"
            icon="chevron-up"
            label={t('feeds.moveUp', { name: feed.name })}
            disabled={first}
            onClick={onMoveUp}
          />
          <IconButton
            size="sm"
            icon="chevron-down"
            label={t('feeds.moveDown', { name: feed.name })}
            disabled={last}
            onClick={onMoveDown}
          />
          <IconButton size="sm" icon="pencil" label={t('feeds.edit', { name: feed.name })} onClick={() => setEditing(true)} />
          <IconButton
            size="sm"
            icon="trash"
            label={t('feeds.removeNamed', { name: feed.name })}
            onClick={() => setConfirming(true)}
          />
        </>
      )}
    </li>
  )
}

interface FeedEditorProps {
  feed: FeedSource
  onCancel: () => void
  /** Resolves why it was refused, or rejects when it could not be saved; the editor stays open for either. */
  onSave: (request: FeedsEditRequest) => Promise<FeedsEditResult>
}

function FeedEditor({ feed, onCancel, onSave }: FeedEditorProps): React.JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState(feed.name)
  const [colour, setColour] = useState<FeedsColour>(isFeedsColour(feed.colour) ? feed.colour : 'blue')
  // Empty keeps the address it has, which the renderer is never told: only its host.
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const named = name.trim() !== ''

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const result = await onSave({
        id: feed.id,
        name: name.trim(),
        ...(colour === feed.colour ? {} : { colour }),
        ...(url.trim() === '' ? {} : { url })
      })
      if (!result.ok) setError(feedFailureText(t, result))
    } catch {
      setError(t('feeds.changeFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-12"
      onSubmit={(event) => {
        event.preventDefault()
        if (named && !saving) void save()
      }}
    >
      <Input
        label={t('feeds.name')}
        value={name}
        onChange={setName}
        {...(named ? {} : { error: t('feeds.failure.invalidName') })}
      />
      <Input
        label={t('feeds.url')}
        value={url}
        onChange={setUrl}
        placeholder={t('feeds.urlKeep', { host: feed.host })}
        icon="link"
        mono
        hint={t('feeds.urlEditHint')}
        {...(error === null ? {} : { error })}
      />
      <ColourPicker colour={colour} onChange={setColour} />
      <div className="flex justify-end gap-8">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="sm" type="submit" loading={saving} disabled={!named}>
          {t('feeds.save')}
        </Button>
      </div>
    </form>
  )
}

interface ColourPickerProps {
  colour: FeedsColour
  onChange: (colour: FeedsColour) => void
}

/** The ten hues types are drawn in, one of which a subscription takes. */
function ColourPicker({ colour, onChange }: ColourPickerProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <fieldset className="m-0 flex flex-col gap-6 border-0 p-0">
      <legend className="mb-6 type-ui text-small text-ink-secondary">{t('config.colour')}</legend>
      <div role="radiogroup" className="flex flex-wrap gap-6">
        {FEEDS_COLOURS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === colour}
            aria-label={t(`feeds.colours.${option}`)}
            onClick={() => onChange(option)}
            className={[
              'flex size-24 items-center justify-center rounded-pill border-2',
              option === colour ? 'border-line-accent' : 'border-transparent'
            ].join(' ')}
          >
            <span className={['size-16 rounded-pill', catBg[hueOf(option)]].join(' ')} />
          </button>
        ))}
      </div>
    </fieldset>
  )
}

interface AddFeedFormProps extends Pick<CalendarsSectionProps, 'onAdd'> {
  /** The colours the subscriptions already have, so the form offers one none has yet. */
  taken: FeedsColour[]
  focus: boolean
}

function AddFeedForm({ onAdd, taken, focus }: AddFeedFormProps): React.JSX.Element {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  // Null until one is picked: the colour no subscription has yet, which changes as they do.
  const [picked, setPicked] = useState<FeedsColour | null>(null)
  const colour = picked ?? nextFeedsColour(taken)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (!focus) return
    form.current?.scrollIntoView({ block: 'center' })
    form.current?.querySelector('input')?.focus()
  }, [focus])

  const add = async (): Promise<void> => {
    setAdding(true)
    setError(null)
    try {
      const result = await onAdd(url, name, colour)
      if (result.ok) {
        setUrl('')
        setName('')
        setPicked(null)
      } else {
        setError(feedFailureText(t, result))
      }
    } catch {
      setError(t('feeds.changeFailed'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <form
      ref={form}
      className="flex flex-col gap-12 border-t border-line-hairline pt-16"
      onSubmit={(event) => {
        event.preventDefault()
        if (url.trim() !== '' && !adding) void add()
      }}
    >
      <h3 className="m-0 type-ui text-small text-ink-primary">{t('feeds.addHeading')}</h3>
      <Input
        label={t('feeds.url')}
        value={url}
        onChange={setUrl}
        placeholder="https://… .ics"
        icon="link"
        mono
        hint={t('feeds.urlHint')}
        {...(error === null ? {} : { error })}
      />
      <Input label={t('feeds.nameOptional')} value={name} onChange={setName} placeholder={t('feeds.namePlaceholder')} />
      <ColourPicker colour={colour} onChange={setPicked} />
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" type="submit" iconLeft="plus" loading={adding} disabled={url.trim() === ''}>
          {t('feeds.add')}
        </Button>
      </div>
    </form>
  )
}
