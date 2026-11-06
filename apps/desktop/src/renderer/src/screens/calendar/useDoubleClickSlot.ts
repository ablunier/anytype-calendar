import { type MouseEvent, useRef } from 'react'

/* The page cannot read the system's double-click interval; this outlasts the usual defaults
 * (500 ms on macOS and Windows) and still drops a press left over from an earlier click. */
const DOUBLE_CLICK_MS = 1000

export interface DoubleClickSlotCapture {
  onMouseDownCapture: (press: MouseEvent) => void
  onClickCapture: (click: MouseEvent) => void
  onDoubleClickCapture: (doubleClick: MouseEvent) => void
}

export interface DoubleClickSlot<Slot> {
  /** Called from the empty slot's click; a press on an object over it never reaches it. */
  press: (click: MouseEvent, slot: Slot) => void
  /** Spread on the element holding both the empty slots and the objects drawn over them. */
  capture: DoubleClickSlotCapture
}

/**
 * Creates at the slot of a double-click's first press. That press selects the day, which opens
 * the panel beside the grid and narrows it, so the second press can land on the next column,
 * another minute, or an object. Caught on the way down, that press neither moves focus, selects,
 * nor reaches the object; a double-click whose first press was on an object is let through.
 */
export function useDoubleClickSlot<Slot>(onCreate: (slot: Slot) => void): DoubleClickSlot<Slot> {
  const first = useRef<{ slot: Slot; at: number } | null>(null)
  const continues = (event: MouseEvent): boolean =>
    event.detail >= 2 && first.current !== null && event.timeStamp - first.current.at <= DOUBLE_CLICK_MS
  return {
    press: (click, slot) => {
      if (click.detail <= 1) first.current = { slot, at: click.timeStamp }
    },
    capture: {
      onMouseDownCapture: (press) => {
        if (continues(press)) press.preventDefault()
      },
      onClickCapture: (click) => {
        if (click.detail <= 1) first.current = null
        else if (continues(click)) click.stopPropagation()
      },
      onDoubleClickCapture: (doubleClick) => {
        const pressed = continues(doubleClick) ? first.current : null
        first.current = null
        if (!pressed) return
        doubleClick.stopPropagation()
        onCreate(pressed.slot)
      },
    },
  }
}
