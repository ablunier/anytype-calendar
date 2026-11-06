import { type MouseEvent, useRef } from 'react'

/* The page cannot read the system's double-click interval; this outlasts the usual defaults
 * (500 ms on macOS and Windows) and still drops a press left over from an earlier click. */
const DOUBLE_CLICK_MS = 1000

export interface DoubleClickSlot<Slot> {
  /** Called on every click; keeps the slot of a click that may start a double-click. */
  press: (click: MouseEvent, slot: Slot) => void
  /** Whether the click is the second press of a double-click, which must not select where it lands. */
  continues: (click: MouseEvent) => boolean
  /** Called on the double-click: the first press's slot, or `slot` when none is recent. */
  take: (doubleClick: MouseEvent, slot: Slot) => Slot
}

/**
 * The slot a double-click asks for, taken from its first press. That press selects the day,
 * which opens the panel beside the grid and narrows it, so the second press, which the browser
 * sends `dblclick` to, can land on the next column or another minute.
 */
export function useDoubleClickSlot<Slot>(): DoubleClickSlot<Slot> {
  const first = useRef<{ slot: Slot; at: number } | null>(null)
  const recent = (event: MouseEvent): boolean =>
    first.current !== null && event.timeStamp - first.current.at <= DOUBLE_CLICK_MS
  return {
    press: (click, slot) => {
      if (click.detail <= 1) first.current = { slot, at: click.timeStamp }
    },
    continues: (click) => click.detail >= 2 && recent(click),
    take: (doubleClick, slot) => {
      const pressed = recent(doubleClick) ? first.current : null
      first.current = null
      return pressed ? pressed.slot : slot
    },
  }
}
