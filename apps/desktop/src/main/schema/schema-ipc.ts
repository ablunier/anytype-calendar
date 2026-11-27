import { toSchemaSelection } from '@anytype-calendar/schema/domain'
import { IpcChannel } from '@shared/ipc'
import type { CalendarIpcRegistrar } from '../platform'
import type { Schema } from './compose-schema'

export function registerSchemaIpc(
  ipc: CalendarIpcRegistrar,
  { schemaSync, schemaState, schemaSelection, saveSchemaSelection }: Schema,
): void {
  ipc.handle(IpcChannel.schemaGet, () => schemaState.get())
  ipc.handle(IpcChannel.schemaSync, () => schemaSync.execute())
  ipc.handle(IpcChannel.schemaSelectionGet, () => schemaSelection.get())
  ipc.handle(IpcChannel.schemaSelectionSave, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const selection = toSchemaSelection(value)
    if (!selection) throw new TypeError('not a schema selection')
    return saveSchemaSelection.execute(selection)
  })

  schemaState.subscribe((state) => ipc.broadcast(IpcChannel.schemaChanged, state))
  schemaSelection.subscribe((state) => ipc.broadcast(IpcChannel.schemaSelectionChanged, state))
}
