import { useEffect, useState } from 'react'

/** State main owns and pushes to every window, e.g. `window.api.session`. Must be stable. */
export interface PushedSource<T> {
  get(): Promise<T>
  onChange(listener: (value: T) => void): () => void
}

/**
 * Undefined until main first answers. Subscribes before asking, and lets a push win over
 * the answer, so a change that lands between the two is never lost.
 */
export function usePushedState<T>(source: PushedSource<T>): T | undefined {
  const [value, setValue] = useState<T>()

  useEffect(() => {
    let active = true
    let pushed = false
    const unsubscribe = source.onChange((next) => {
      pushed = true
      setValue(next)
    })
    source.get().then((current) => {
      if (active && !pushed) setValue(current)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [source])

  return value
}
