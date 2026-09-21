import { usePushedState } from './usePushedState'

/** Off until main reports otherwise. Saves go to main, which pushes the value back. */
export function useWeekNumbers(): [boolean, (shown: boolean) => void] {
  const shown = usePushedState(window.api.weekNumbers) ?? false
  return [shown, (next) => void window.api.weekNumbers.save(next)]
}
