import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarEvent, EventDetail, IconName, ObjectType } from '@renderer/types'
import { Icon, Tag } from '@renderer/components/ui'
import { formatNumber, panelLabel } from '@renderer/lib/calendar'

const ICONS: Record<EventDetail['kind'], IconName> = {
  text: 'file-text',
  number: 'list',
  link: 'link',
  options: 'tag',
  objects: 'layers'
}

const LINK_CLASS =
  'rounded-control text-left text-ink-accent underline decoration-line-strong underline-offset-2 hover:decoration-current'

export interface EventDetailsProps {
  event: CalendarEvent
  type: ObjectType | undefined
}

/** One row per property, in the order its type's panel shows them, each named above its value. */
export function EventDetails({ event, type }: EventDetailsProps): React.JSX.Element | null {
  if (event.details.length === 0) return null
  return (
    <>
      {event.details.map((detail) => (
        <div key={detail.key} className="flex items-start gap-10">
          <Icon name={ICONS[detail.kind]} size={16} className="mt-2 shrink-0 text-ink-tertiary" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="type-caption text-tiny text-ink-tertiary">
              {type ? panelLabel(type, detail.key) : detail.key}
            </span>
            <DetailValue detail={detail} space={event.space} />
          </div>
        </div>
      ))}
    </>
  )
}

function DetailValue({ detail, space }: { detail: EventDetail; space: string }): React.JSX.Element {
  const { i18n } = useTranslation()
  switch (detail.kind) {
    case 'text':
      return <ClampedText>{detail.text}</ClampedText>
    case 'number':
      return (
        <span className="type-numeral text-small text-ink-body">{formatNumber(detail.value, i18n.language)}</span>
      )
    case 'link':
      return (
        <button
          type="button"
          className={`type-body text-small break-all ${LINK_CLASS}`}
          onClick={() => window.api.shell.openLink(detail.href)}
        >
          {detail.text}
        </button>
      )
    case 'options':
      return (
        <div className="flex flex-wrap gap-4">
          {detail.options.map((option, index) => (
            <Tag key={`${option.name}-${index}`} category={option.category}>
              {option.name}
            </Tag>
          ))}
        </div>
      )
    case 'objects':
      return (
        <ul className="flex flex-col gap-2">
          {detail.objects.map((object) => (
            <li key={object.id} className="type-body text-small text-pretty text-ink-body">
              {object.member ? (
                object.name
              ) : (
                <button
                  type="button"
                  className={LINK_CLASS}
                  onClick={() => window.api.shell.openObject(object.id, space)}
                >
                  {object.name || object.id}
                </button>
              )}
            </li>
          ))}
        </ul>
      )
  }
}

/** Four lines at most until asked for the rest; the toggle shows only when there is more. */
function ClampedText({ children }: { children: ReactNode }): React.JSX.Element {
  const { t } = useTranslation()
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)

  useLayoutEffect(() => {
    const paragraph = ref.current
    if (paragraph && !expanded) setClamped(paragraph.scrollHeight > paragraph.clientHeight)
  }, [children, expanded])

  return (
    <div className="flex flex-col items-start gap-2">
      <p
        ref={ref}
        className={[
          'type-body text-small text-pretty break-words whitespace-pre-line text-ink-body',
          expanded ? '' : 'line-clamp-4'
        ].join(' ')}
      >
        {children}
      </p>
      {clamped ? (
        <button
          type="button"
          className="rounded-control type-caption text-tiny text-ink-accent"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? t('calendar.eventDetail.showLess') : t('calendar.eventDetail.showMore')}
        </button>
      ) : null}
    </div>
  )
}
