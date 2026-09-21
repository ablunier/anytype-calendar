import { BrowserWindow, ipcMain } from "electron";
import { IpcChannel } from "@shared/ipc";
import type { AppServices } from "../composition";
import { toTimeFormat } from "./time-format-store";

export function registerTimeFormatIpc({
  timeFormatState,
  saveTimeFormat,
}: AppServices): void {
  ipcMain.handle(IpcChannel.timeFormatGet, () => timeFormatState.get());
  ipcMain.handle(IpcChannel.timeFormatSave, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const format = toTimeFormat(value);
    if (format === null) throw new TypeError("not a time-format preference");
    return saveTimeFormat.execute(format);
  });

  timeFormatState.subscribe((format) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.timeFormatChanged, format);
    }
  });
}
