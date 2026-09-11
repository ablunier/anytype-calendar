import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './IconButton'

export type DialogWidth = 'default' | 'wide'

const widthClass: Record<DialogWidth, string> = {
  default: 'w-440',
  wide: 'w-460'
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  description?: string
  children?: ReactNode
  footer?: ReactNode
  width?: DialogWidth
}

/**
 * Beyond the design system's version this moves focus into the sheet on open, restores it
 * to the invoking control on close, and keeps Tab inside the dialog while it is open —
 * without which a modal is unusable from the keyboard.
 */
export function Dialog({
  open,
  title,
  onClose,
  description,
  children,
  footer,
  width = 'default'
}: DialogProps): React.JSX.Element | null {
  const id = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const focusable = useCallback((): HTMLElement[] => {
    const root = sheetRef.current
    return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
  }, [])

  useEffect(() => {
    if (!open) return
    returnFocusRef.current = document.activeElement as HTMLElement | null
    focusable()[0]?.focus()
    return () => returnFocusRef.current?.focus()
  }, [open, focusable])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, focusable])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      className="animate-scrim fixed inset-0 z-60 flex items-center justify-center bg-overlay-scrim p-24"
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        onClick={(event) => event.stopPropagation()}
        className={[
          'animate-sheet max-w-full overflow-hidden rounded-sheet border border-line-subtle',
          'bg-surface-raised shadow-3',
          widthClass[width]
        ].join(' ')}
      >
        <div className="flex items-start gap-12 px-20 pt-20 pb-12">
          <div className="flex flex-1 flex-col gap-4">
            <h2 id={`${id}-title`} className="type-heading text-h4 text-ink-primary">
              {title}
            </h2>
            {description ? (
              <p id={`${id}-description`} className="type-body text-small text-ink-secondary">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        {children ? <div className="px-20 pb-16">{children}</div> : null}
        {footer ? (
          /* The system's own Dialog fills this footer with the --stone-025 primitive, which
             the dark theme never re-points — it would stay near-white on a dark sheet. The
             --surface-rail alias resolves to exactly stone-025 in light and to #1f1e1c in
             dark, so this matches the design and survives the theme switch. */
          <div className="flex justify-end gap-8 border-t border-line-subtle bg-surface-rail px-20 py-12">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
