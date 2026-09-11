import type { SchemaSnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

export function useSchemaSync(): SchemaSnapshot | undefined {
  return usePushedState(window.api.schema)
}
