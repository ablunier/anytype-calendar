import { useEffect, useState } from 'react'
import type { SessionSnapshot } from '@shared/ipc'

/**
 * Undefined until main first answers. Subscribes before asking, and lets a push win over
 * the answer, so a change that lands between the two is never lost.
 */
export function useSession(): SessionSnapshot | undefined {
  const [session, setSession] = useState<SessionSnapshot>()

  useEffect(() => {
    let active = true
    let pushed = false
    const unsubscribe = window.api.session.onChange((next) => {
      pushed = true
      setSession(next)
    })
    window.api.session.get().then((current) => {
      if (active && !pushed) setSession(current)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return session
}
