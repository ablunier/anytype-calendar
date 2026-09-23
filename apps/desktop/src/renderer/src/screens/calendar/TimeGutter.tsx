import { useTranslation } from 'react-i18next'
import { useTimeFormatValue } from '@renderer/hooks/TimeFormatContext'
import { formatTime } from '@renderer/lib/calendar'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/**
 * The hour scale down the left of the time grid. Each label sits on its hour's line rather
 * than inside the row, so it reads as the moment the line marks; midnight is left unlabelled,
 * having no line above it to name.
 */
export function TimeGutter(): React.JSX.Element {
  const { i18n } = useTranslation()
  const timeFormat = useTimeFormatValue()
  return (
    <div aria-hidden className="day-canvas w-hour-gutter shrink-0">
      {HOURS.map((hour) => (
        <div key={hour} className="hour-row relative">
          {hour === 0 ? null : (
            <span className="absolute -top-6 right-6 font-mono text-micro tracking-mono text-ink-muted tabular-nums">
              {formatTime(`${String(hour).padStart(2, '0')}:00`, timeFormat, i18n.language)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
