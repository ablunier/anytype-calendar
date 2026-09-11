import type { SchemaSelectionSnapshot } from '@shared/ipc'
import { usePushedState } from './usePushedState'

export function useSchemaSelection(): SchemaSelectionSnapshot | undefined {
  return usePushedState(window.api.schemaSelection)
}
