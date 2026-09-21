import { BrowserWindow, ipcMain } from "electron";
import { IpcChannel } from "@shared/ipc";
import type { AppServices } from "../composition";
import { toWeekStart } from "./week-start-store";

export function registerWeekStartIpc({
  weekStartState,
  saveWeekStart,
}: AppServices): void {
  ipcMain.handle(IpcChannel.weekStartGet, () => weekStartState.get());
  ipcMain.handle(IpcChannel.weekStartSave, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const day = toWeekStart(value);
    if (day === null) throw new TypeError("not a week-start preference");
    return saveWeekStart.execute(day);
  });

  weekStartState.subscribe((day) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.weekStartChanged, day);
    }
  });
}
