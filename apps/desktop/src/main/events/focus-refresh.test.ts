import { expect, test, vi } from 'vitest'
import { throttled } from './focus-refresh'

function setup(lastRun?: number) {
  let time = 1_000
  const action = vi.fn()
  const run = throttled(action, 500, () => time, lastRun)
  return {
    action,
    run,
    advance: (ms: number) => {
      time += ms
    }
  }
}

test('runs on the first call', () => {
  const { action, run } = setup()
  run()
  expect(action).toHaveBeenCalledTimes(1)
})

test('drops calls within the interval, and runs again once it has passed', () => {
  const { action, run, advance } = setup()
  run()
  advance(499)
  run()
  expect(action).toHaveBeenCalledTimes(1)
  advance(1)
  run()
  expect(action).toHaveBeenCalledTimes(2)
})

test('measures the interval from the last run, not the last call', () => {
  const { action, run, advance } = setup()
  run()
  advance(300)
  run()
  advance(200)
  run()
  expect(action).toHaveBeenCalledTimes(2)
})

test('counts a given last run', () => {
  const { action, run, advance } = setup(1_000)
  run()
  expect(action).not.toHaveBeenCalled()
  advance(500)
  run()
  expect(action).toHaveBeenCalledTimes(1)
})
