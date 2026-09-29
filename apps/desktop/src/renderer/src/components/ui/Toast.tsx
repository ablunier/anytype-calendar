import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'
import { IconButton } from './IconButton'

/** Long enough to read two lines of an error without having to chase it. */
const TOAST_MS = 7_000

export interface ToastProps {
  message: string
  onDismiss: () => void
}

/**
 * A passing message over the bottom of the window, gone after a few seconds or on dismissal.
 * Mount it with a fresh `key` for each message, so a repeat of the same text starts its own
 * timer. `role="alert"`: it only ever reports something that did not happen.
 */
export function Toast({ message, onDismiss }: ToastProps): React.JSX.Element {
  const { t } = useTranslation()

  useEffect(() => {
    const timer = setTimeout(onDismiss, TOAST_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      role="alert"
      className={[
        'animate-sheet fixed bottom-24 left-1/2 z-60 flex max-w-440 -translate-x-1/2 items-start gap-10',
        'rounded-8 border border-line-subtle bg-surface-raised py-8 pr-8 pl-12 shadow-3'
      ].join(' ')}
    >
      <Icon name="circle-alert" size={16} className="mt-4 shrink-0 text-ink-danger" />
      <span className="flex-1 py-2 type-body text-small text-pretty text-ink-body">{message}</span>
      <IconButton icon="x" label={t('common.dismiss')} onClick={onDismiss} />
    </div>
  )
}
