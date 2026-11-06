// The input events the driver sends with `webContents.sendInputEvent`. Pure, so they are
// unit-tested in input.test.mjs without a running app.

/** Electron's names for the keys whose DOM `key` differs. */
const ELECTRON_KEY_NAMES = { Enter: 'Return', ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down' }

/** Electron's key names, plus the `char` event Enter, Space and printable keys need to act. */
export function keyEvents(key) {
  const keyCode = ELECTRON_KEY_NAMES[key] ?? key
  const char = keyCode === 'Return' || keyCode === 'Space' || keyCode.length === 1
  return [
    { type: 'keyDown', keyCode },
    ...(char ? [{ type: 'char', keyCode: keyCode === 'Space' ? ' ' : keyCode }] : []),
    { type: 'keyUp', keyCode },
  ]
}

/** A left click at window coordinates, in CSS pixels; `sendInput` scales them to DIPs. */
export const mouseClick = (x, y) => [
  { type: 'mouseDown', x, y, button: 'left', clickCount: 1 },
  { type: 'mouseUp', x, y, button: 'left', clickCount: 1 },
]
