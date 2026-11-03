import { BrowserWindow, ipcMain } from 'electron'
import { toSchemaSelection } from '@anytype-calendar/schema/domain'
import { IpcChannel } from '@shared/ipc'
import type { Schema } from './compose-schema'

export function registerSchemaIpc({
  schemaSync,
  schemaState,
  schemaSelection,
  saveSchemaSelection
}: Schema): void {
  ipcMain.handle(IpcChannel.schemaGet, () => schemaState.get())
  ipcMain.handle(IpcChannel.schemaSync, () => schemaSync.execute())
  ipcMain.handle(IpcChannel.schemaSelectionGet, () => schemaSelection.get())
  ipcMain.handle(IpcChannel.schemaSelectionSave, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const selection = toSchemaSelection(value)
    if (!selection) throw new TypeError('not a schema selection')
    return saveSchemaSelection.execute(selection)
  })

  schemaState.subscribe((state) => broadcast(IpcChannel.schemaChanged, state))
  schemaSelection.subscribe((state) => broadcast(IpcChannel.schemaSelectionChanged, state))
}

function broadcast(channel: string, state: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, state)
}
