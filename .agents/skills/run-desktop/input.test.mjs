import { describe, expect, it } from 'vitest'
import { keyEvents, mouseClick } from './input.mjs'

describe('keyEvents', () => {
  it('maps Enter to Return and adds the char event that activates buttons', () => {
    expect(keyEvents('Enter')).toEqual([
      { type: 'keyDown', keyCode: 'Return' },
      { type: 'char', keyCode: 'Return' },
      { type: 'keyUp', keyCode: 'Return' },
    ])
  })

  it('sends Space as a literal space in its char event', () => {
    expect(keyEvents('Space')[1]).toEqual({ type: 'char', keyCode: ' ' })
  })

  it('maps arrow keys to Electron names without a char event', () => {
    expect(keyEvents('ArrowLeft')).toEqual([
      { type: 'keyDown', keyCode: 'Left' },
      { type: 'keyUp', keyCode: 'Left' },
    ])
  })

  it('passes named keys such as Escape and End through without a char event', () => {
    expect(keyEvents('Escape').map((event) => event.type)).toEqual(['keyDown', 'keyUp'])
    expect(keyEvents('End')[0]).toEqual({ type: 'keyDown', keyCode: 'End' })
  })

  it('adds a char event for a single printable character', () => {
    expect(keyEvents('a')).toEqual([
      { type: 'keyDown', keyCode: 'a' },
      { type: 'char', keyCode: 'a' },
      { type: 'keyUp', keyCode: 'a' },
    ])
  })

  it('holds Shift through every event of an uppercase letter', () => {
    expect(keyEvents('A')).toEqual([
      { type: 'keyDown', keyCode: 'A', modifiers: ['shift'] },
      { type: 'char', keyCode: 'A', modifiers: ['shift'] },
      { type: 'keyUp', keyCode: 'A', modifiers: ['shift'] },
    ])
  })

  it('adds no modifier to digits and symbols, which have no case', () => {
    expect(keyEvents('7').every((event) => !('modifiers' in event))).toBe(true)
  })
})

describe('mouseClick', () => {
  it('is a left mouseDown then mouseUp at the same point', () => {
    expect(mouseClick(10, 20)).toEqual([
      { type: 'mouseDown', x: 10, y: 20, button: 'left', clickCount: 1 },
      { type: 'mouseUp', x: 10, y: 20, button: 'left', clickCount: 1 },
    ])
  })
})
