import type { ApiVersionSnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

/** Automatic until main reports otherwise. Saves go to main, which pushes the value back. */
export function useApiVersion(): [ApiVersionSnapshot, (preference: ApiVersionSnapshot) => void] {
  const preference = usePushedState(window.api.apiVersion) ?? 'auto'
  return [preference, (next) => void window.api.apiVersion.save(next)]
}
