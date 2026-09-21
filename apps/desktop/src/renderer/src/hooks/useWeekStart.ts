import { usePushedState } from "./usePushedState";

/** Monday (0) until main reports otherwise. Saves go to main, which pushes the value back. */
export function useWeekStart(): [number, (day: number) => void] {
  const day = usePushedState(window.api.weekStart) ?? 0;
  return [day, (next) => void window.api.weekStart.save(next)];
}
