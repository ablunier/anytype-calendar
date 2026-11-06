import { type MouseEvent, useRef } from 'react'

/* The page cannot read the system's double-click interval; this outlasts the usual defaults
 * (500 ms on macOS and Windows) and still drops a press left over from an earlier click. */
const DOUBLE_CLICK_MS = 1000

export interface DoubleClickSlot<Slot> {
  /** Called on every click; keeps the slot of a click that may start a double-click. */
  press: (click: MouseEvent, slot: Slot) => void
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
  return {
    press: (click, slot) => {
      if (click.detail <= 1) first.current = { slot, at: click.timeStamp }
    },
    take: (doubleClick, slot) => {
      const pressed = first.current
      first.current = null
      return pressed && doubleClick.timeStamp - pressed.at <= DOUBLE_CLICK_MS ? pressed.slot : slot
    },
  }
}
