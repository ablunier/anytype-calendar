import { describe, expect, test, vi } from "vitest";
import { appConfigStore } from "../app-config-file";
import type { AtomicFile } from "../atomic-file";
import { LoadWeekStart } from "./load-week-start";
import { SaveWeekStart } from "./save-week-start";
import { toWeekStart, WeekStartStore } from "./week-start-store";

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
  const store = new WeekStartStore();
  const listener = vi.fn();
  store.subscribe(listener);
  return {
    config,
    store,
    listener,
    load: new LoadWeekStart({ config, store }),
    save: new SaveWeekStart({ config, store }),
  };
}

describe("toWeekStart", () => {
  test("accepts only the integers 0 to 6", () => {
    expect(toWeekStart(0)).toBe(0);
    expect(toWeekStart(6)).toBe(6);
    expect(toWeekStart(7)).toBeNull();
    expect(toWeekStart(-1)).toBeNull();
    expect(toWeekStart(1.5)).toBeNull();
    expect(toWeekStart("1")).toBeNull();
    expect(toWeekStart(undefined)).toBeNull();
  });
});

describe("LoadWeekStart", () => {
  test("is Monday when nothing was ever saved", async () => {
    const { store, load } = setup();
    await load.execute();
    expect(store.get()).toBe(0);
  });

  test("restores a saved day", async () => {
    const { config, store, load } = setup();
    await config.writeSection("weekStart", 6);
    await load.execute();
    expect(store.get()).toBe(6);
  });

  test("is Monday when the saved value is not a day", async () => {
    const { config, store, load } = setup();
    await config.writeSection("weekStart", "sunday");
    await load.execute();
    expect(store.get()).toBe(0);
  });
});

describe("SaveWeekStart", () => {
  test("writes the day, then holds it", async () => {
    const { config, store, listener, save } = setup();
    await save.execute(6);
    expect(await config.readSection("weekStart")).toBe(6);
    expect(store.get()).toBe(6);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("keeps the other sections untouched", async () => {
    const { config, save } = setup();
    await config.writeSection("theme", "dark");
    await save.execute(6);
    expect(await config.readSection("theme")).toBe("dark");
  });
});
