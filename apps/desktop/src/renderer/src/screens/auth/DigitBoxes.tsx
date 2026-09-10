export interface DigitBoxesProps {
  /** The digits typed so far, at most four. */
  value: string
  invalid?: boolean
  /** Dims the boxes while the code is being exchanged. */
  muted?: boolean
}

const CELLS = [0, 1, 2, 3]

/**
 * The four-digit code Anytype displays, rendered as separate boxes.
 *
 * Presentational only — the real input lives in AuthCode, which owns the keystrokes. The
 * boxes are marked aria-hidden so a screen reader reads the field's own value once rather
 * than four disconnected characters.
 */
export function DigitBoxes({ value, invalid = false, muted = false }: DigitBoxesProps): React.JSX.Element {
  return (
    <div className="flex gap-8" aria-hidden>
      {CELLS.map((index) => {
        const char = value[index]
        const active = !muted && !invalid && index === value.length
        return (
          <div
            key={index}
            className={[
              'flex h-64 flex-1 items-center justify-center rounded-control border bg-surface-card',
              'font-mono text-h2 font-medium tracking-mono transition-colors duration-base ease-standard',
              invalid ? 'border-clay-500 text-ink-danger' : 'text-ink-primary',
              !invalid && active ? 'border-moss-500 shadow-focus' : '',
              !invalid && !active ? 'border-line-default' : '',
              muted ? 'opacity-55' : ''
            ].join(' ')}
          >
            {char ??
              (active ? (
                <span className="h-30 w-px bg-moss-500" />
              ) : (
                <span className="text-ink-tertiary">·</span>
              ))}
          </div>
        )
      })}
    </div>
  )
}
