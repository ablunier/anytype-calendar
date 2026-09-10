import type { ReactNode } from 'react'

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right'
/** Where the bubble sits along the trigger's edge. `end` keeps it inside a right margin. */
export type TooltipAlign = 'center' | 'end'

const sideClass: Record<TooltipSide, Record<TooltipAlign, string>> = {
  top: {
    center: 'bottom-full left-1/2 mb-6 -translate-x-1/2',
    end: 'bottom-full right-0 mb-6'
  },
  bottom: {
    center: 'top-full left-1/2 mt-6 -translate-x-1/2',
    end: 'top-full right-0 mt-6'
  },
  left: {
    center: 'right-full top-1/2 mr-6 -translate-y-1/2',
    end: 'right-full bottom-0 mr-6'
  },
  right: {
    center: 'left-full top-1/2 ml-6 -translate-y-1/2',
    end: 'left-full bottom-0 ml-6'
  }
}

export interface TooltipProps {
  children: ReactNode
  label: string
  side?: TooltipSide
  /** Use `end` next to a container edge — a centered bubble there overflows the page. */
  align?: TooltipAlign
  shortcut?: string
}

/**
 * Dark hover label for icon-only affordances. Appears after 140ms, no arrow.
 *
 * Shown on focus-within as well as hover, so the label is reachable from the keyboard —
 * the design system's version is hover-only.
 */
export function Tooltip({
  children,
  label,
  side = 'top',
  align = 'center',
  shortcut
}: TooltipProps): React.JSX.Element {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={[
          'pointer-events-none absolute z-40 flex items-center gap-6 whitespace-nowrap',
          'rounded-6 bg-stone-800 px-8 py-4 type-caption text-tiny text-stone-025 shadow-2',
          'opacity-0 transition-opacity duration-fast ease-standard delay-140',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          sideClass[side][align]
        ].join(' ')}
      >
        {label}
        {shortcut ? <span className="font-mono text-stone-400">{shortcut}</span> : null}
      </span>
    </span>
  )
}
