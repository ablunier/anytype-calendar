import { describe, expect, test, vi } from "vitest";
import { appConfigStore } from "../app-config-file";
import type { AtomicFile } from "../atomic-file";
import { LoadTimeFormat } from "./load-time-format";
import { SaveTimeFormat } from "./save-time-format";
import { toTimeFormat, TimeFormatStore } from "./time-format-store";

function fakeFile(): AtomicFile {
  let bytes: Buffer | null = null;
  return {
    read: async () => bytes,
    write: async (next) => {
      bytes = Buffer.from(next);
    },
    remove: async () => {
      bytes = null;
    },
  };
}

function setup() {
  const config = appConfigStore(fakeFile());
  const store = new TimeFormatStore();
  const listener = vi.fn();
  store.subscribe(listener);
  return {
    config,
    store,
    listener,
    load: new LoadTimeFormat({ config, store }),
    save: new SaveTimeFormat({ config, store }),
  };
}

describe("toTimeFormat", () => {
  test("accepts only 24h and 12h", () => {
    expect(toTimeFormat("24h")).toBe("24h");
    expect(toTimeFormat("12h")).toBe("12h");
    expect(toTimeFormat("12")).toBeNull();
    expect(toTimeFormat(12)).toBeNull();
    expect(toTimeFormat(undefined)).toBeNull();
  });
});

describe("LoadTimeFormat", () => {
  test("is 24h when nothing was ever saved", async () => {
    const { store, load } = setup();
    await load.execute();
    expect(store.get()).toBe("24h");
  });

  test("restores a saved format", async () => {
    const { config, store, load } = setup();
    await config.writeSection("timeFormat", "12h");
    await load.execute();
    expect(store.get()).toBe("12h");
  });

  test("is 24h when the saved value is not a format", async () => {
    const { config, store, load } = setup();
    await config.writeSection("timeFormat", "am/pm");
    await load.execute();
    expect(store.get()).toBe("24h");
  });
});

describe("SaveTimeFormat", () => {
  test("writes the format, then holds it", async () => {
    const { config, store, listener, save } = setup();
    await save.execute("12h");
    expect(await config.readSection("timeFormat")).toBe("12h");
    expect(store.get()).toBe("12h");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("keeps the other sections untouched", async () => {
    const { config, save } = setup();
    await config.writeSection("theme", "dark");
    await save.execute("12h");
    expect(await config.readSection("theme")).toBe("dark");
  });
});
