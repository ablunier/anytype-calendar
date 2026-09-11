---
name: run-desktop
description: Build, run, and drive the Calendar for Anytype Electron desktop app. Use when asked to start or launch the app, sign in (real or fake Anytype), take a screenshot of a screen, click through the UI, inspect the auth session or schema sync state, evaluate code in the main process, or confirm a change works in the running app.
---

Calendar for Anytype is an Electron + React app. Agents drive it with
`.claude/skills/run-desktop/driver.mjs`, a dependency-free Node CLI. `launch` starts the
**built** app detached, with the Chrome DevTools Protocol on the renderer (port 9333) and
the Node inspector on the main process (port 9335). Every other command connects, does one
thing, prints, and exits, so there is no REPL and no tmux.

All paths below are relative to `apps/desktop/`.

## Prerequisites

- Node 22+, for the global `fetch`/`WebSocket` the driver uses. It was verified on 26.8.1.
- **A real display session** (`DISPLAY` / `WAYLAND_DISPLAY` set). The window opens on the
  desktop. Headless Ozone crashes (see Gotchas), and xvfb was not available or tried here.
- Anytype desktop running, for real mode only. Fake mode needs nothing.

## Setup

```bash
cd ../.. && npm install && cd apps/desktop   # root postinstall fetches the Electron binary
```

## Build

The driver runs `out/`, not the dev server. **Rebuild after every source change**, then
`quit` and `launch` again:

```bash
npm run build
```

## Run (agent path)

```bash
D=.claude/skills/run-desktop/driver.mjs
node $D launch --fake          # simulated Anytype; omit --fake for the real one
node $D state                  # main's session + schema snapshots, as the renderer sees them
node $D sign-in-fake           # start → type 2749 → verify, in one go
node $D wait-text "Synced"     # the success card's sync finished
node $D ss success-synced      # -> /tmp/run-desktop/shots/success-synced.png
node $D text ul                # innerText of the first match (no selector = whole body)
node $D click-text "Choose spaces and types"
node $D sign-out
node $D quit
```

Driving the code screen by hand works too, if you chain it in **one** shell line (see
Gotchas on expiry):

```bash
node $D click-text "Start connection" && node $D wait-text Verify && node $D focus 'input[inputmode="numeric"]' && node $D type 2749 && node $D click-text Verify && node $D wait-text "Connected to your account"
```

To evaluate in the main process, pass an expression; `process.mainModule.require` reaches
`electron` and Node core:

```bash
node $D main-eval "process.mainModule.require('electron').app.getPath('userData')"
```

The driver's log, pid file and screenshots are in `/tmp/run-desktop/`. Override the
directory with `RUN_DESKTOP_DIR`, the screenshot folder with `SCREENSHOT_DIR`, and the ports
with `RUN_DESKTOP_PAGE_PORT` / `RUN_DESKTOP_MAIN_PORT`.

| command | what it does |
|---|---|
| `launch [--fake]` | Starts the built app and waits until the renderer has drawn. `--fake` sets `ANYTYPE_CALENDAR_FAKE_AUTH=1`. |
| `quit` | Stops only the pid `launch` recorded. |
| `state` | `{ session, schema }` snapshots from `window.api`. |
| `sign-in-fake` | Full fake sign-in, ending on the success card. |
| `sign-out` | `window.api.auth.signOut()`. |
| `ss [name]` | 900×670 PNG of the window. |
| `text [selector]` | innerText of the selector's match, or of the whole body. |
| `eval <expr>` | Evaluates an expression in the page (promises are awaited) and prints the result. |
| `click-text <text>` | Clicks a button or link by text. Prints `OK`, `NOT_FOUND` or `DISABLED`. |
| `focus <selector>` / `type <text>` | Focuses an element / inserts text into the focused one. |
| `wait-text <text> [ms]` | Polls the body text. Prints `found` or `TIMEOUT` (default 10 s). |
| `main-eval <expr>` | Evaluates an expression in the Electron main process. |

## Run (human path)

`npm run dev` from the repo root starts the electron-vite dev server with HMR (see
CLAUDE.md's Commands section, including its `env -u ELECTRON_RUN_AS_NODE` requirement). It
wasn't exercised while writing this skill, and nothing in it is drivable: it opens no
debugging ports.

## Test

```bash
cd ../.. && npm test && npm run typecheck && npm run lint:arch
```

These are vitest over `packages/*` (the renderer has no tests), `tsc -b`, and the
dependency-cruiser check. `lint:arch` first needs `npm run lint:arch:setup` once.

## Gotchas

- **Headless Electron segfaults.** With `--ozone-platform=headless` (with or without
  `--disable-gpu`), Electron 44 exits with code 139 as soon as a `BrowserWindow` is created.
  A bare three-line app does the same, so this is not the app's fault. Use the real display.
- **Codes expire after 60 s by the app's clock.** Separate driver calls with thinking in
  between let the challenge lapse, and the card reads "That code expired / Submitted after
  the code expired". Use `sign-in-fake`, or chain the manual steps in one shell line.
- **The success card only shows when the window watched the sign-in.** If a key is restored
  at launch, the app opens straight on the month view. To see the card, run `sign-out` and
  then `sign-in-fake`.
- **The fake key persists** in `credential-fake.bin`, so the next `launch --fake` restores
  it and opens the month view. Run `sign-out` before `quit` to leave fake mode clean.
- **Real mode uses the human's real key.** `userData` is
  `~/.config/anytype-calendar-desktop`, shared with the human's own `npm run dev`. A plain
  `launch` restores `credential.bin` and immediately syncs the real account; the reads are
  read-only. Don't `sign-out` in real mode unless asked: it deletes their stored key.
- **"Connected" doesn't prove the key works.** If the key was deleted in Anytype's
  settings, the session still restores as `connected` (the month view shows), but
  `state` reports `schema: { phase: 'failed', failure: 'unauthorized' }`. `main-eval` can
  confirm it: Anytype answers `401 {"code":"unauthorized","message":"invalid api key"}` to
  `GET /v1/spaces`.
- **Only the success card has real data.** Onboarding, config and the month view still
  draw from `src/renderer/src/mocks/index.ts`, whatever mode you are in.
- **`eval` takes an expression, not statements.** The driver wraps it as
  `(async () => (<expr>))()` so a `const` can't leak into the page's global scope (raw
  `Runtime.evaluate` of `const b = …` twice throws "Identifier 'b' has already been
  declared"). For statements, pass an IIFE: `"(() => { …; return x })()"`.
- **Never pattern-kill Electron.** The human may be running `npm run dev` alongside.
  `quit` kills only the recorded pid.

## Troubleshooting

- **`ERROR: nothing listening on 9333 — run \`launch\` first`**: the app isn't running, or
  it exited. Check `/tmp/run-desktop/electron.log`.
- **`ERROR: electron exited during launch`**: read the log. An `isPackaged` TypeError means
  `ELECTRON_RUN_AS_NODE` leaked in; the driver strips it, but a hand-run `npm run dev` needs
  `env -u ELECTRON_RUN_AS_NODE`.
- **`ERROR: no build at …/out/main/index.js`**: run `npm run build`.
- **Electron keeps running after you kill a background `bash -c 'electron …'`**: killing
  the wrapper shell leaves Electron orphaned. Kill the Electron pid itself, or better, use
  `launch`/`quit`, which track it.
- **`file exists: …log` when redirecting a hand-launched Electron's output**: zsh has
  `noclobber` set here. Use `>|` to overwrite.
