import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ObjectType, PanelProperty } from '@renderer/types'
import { Button, Checkbox, Dialog, IconButton } from '@renderer/components/ui'

export interface PanelDialogProps {
  type: ObjectType
  open: boolean
  /** Keys, in the order the panel shows them. */
  panel: string[]
  onChange: (panel: string[]) => void
  onClose: () => void
}

/**
 * The properties shown come first, in their order, then the rest in the type's. Only the shown
 * ones move: by dragging, or with their arrow buttons from the keyboard.
 */
export function PanelDialog({ type, open, panel, onChange, onClose }: PanelDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [dragged, setDragged] = useState<number | null>(null)
  const shown = panel.flatMap((key) => type.panelProps.filter((prop) => prop.key === key))
  const rest = type.panelProps.filter((prop) => !panel.includes(prop.key))

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= shown.length || from === to) return
    const keys = shown.map(({ key }) => key)
    const [key] = keys.splice(from, 1)
    if (key !== undefined) keys.splice(to, 0, key)
    onChange(keys)
  }

  const row = (prop: PanelProperty, index: number | null): React.JSX.Element => (
    <li
      key={prop.key}
      draggable={index !== null}
      onDragStart={index === null ? undefined : () => setDragged(index)}
      onDragEnd={() => setDragged(null)}
      onDragOver={index === null || dragged === null ? undefined : (event) => event.preventDefault()}
      onDrop={
        index === null || dragged === null
          ? undefined
          : (event) => {
              event.preventDefault()
              move(dragged, index)
              setDragged(null)
            }
      }
      className={[
        'flex items-center gap-8 rounded-control px-8 py-6',
        index === null ? '' : 'cursor-grab hover:bg-surface-hover',
        dragged === index && index !== null ? 'opacity-45' : ''
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <Checkbox
          checked={index !== null}
          label={prop.label}
          onChange={(checked) =>
            onChange(checked ? [...shown.map(({ key }) => key), prop.key] : panel.filter((key) => key !== prop.key))
          }
        />
      </div>
      <span className="type-caption text-tiny text-ink-tertiary">{t(`config.panelFormat.${prop.format}`)}</span>
      {index === null ? (
        <span className="w-52" />
      ) : (
        <span className="flex w-52 justify-end gap-2">
          <IconButton
            icon="chevron-up"
            size="sm"
            label={t('config.moveUp', { label: prop.label })}
            disabled={index === 0}
            onClick={() => move(index, index - 1)}
          />
          <IconButton
            icon="chevron-down"
            size="sm"
            label={t('config.moveDown', { label: prop.label })}
            disabled={index === shown.length - 1}
            onClick={() => move(index, index + 1)}
          />
        </span>
      )}
    </li>
  )

  return (
    <Dialog
      open={open}
      title={t('config.panelTitle', { label: type.label })}
      description={t('config.panelDescription')}
      onClose={onClose}
      footer={
        <Button variant="primary" size="md" onClick={onClose}>
          {t('config.panelClose')}
        </Button>
      }
    >
      {type.panelProps.length === 0 ? (
        <p className="type-body text-small text-ink-tertiary">{t('config.panelEmpty')}</p>
      ) : (
        <ul className="flex max-h-[50vh] flex-col overflow-auto">
          {shown.map((prop, index) => row(prop, index))}
          {rest.map((prop) => row(prop, null))}
        </ul>
      )}
    </Dialog>
  )
}
