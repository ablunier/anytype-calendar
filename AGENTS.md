# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## What this is

An Electron + React desktop app that renders Anytype objects (with date properties) on a
calendar. It talks to the Anytype local API. npm workspaces monorepo, currently in an
early pass: the UI (`apps/desktop`) is fully built against mock data; the backend is being
built as one package per bounded context under `packages/` — `auth` is the first, and is
still scaffolded (`export {}` placeholders), with wiring left for a later pass.

## Commands

Run from the repo root unless noted.

- `npm run dev` — start the desktop app (electron-vite dev server + Electron).
  **Must** be run with `env -u ELECTRON_RUN_AS_NODE` set, e.g.
  `env -u ELECTRON_RUN_AS_NODE npm run dev` — otherwise Electron launches in Node mode and
  fails with a misleading `isPackaged` TypeError.
- `npm run build` — `tsc -b` (typecheck + build all package project references) then build
  the desktop app.
- `npm run typecheck` — `tsc -b --force` across the whole monorepo (all project references).
- `npm test` — `vitest run` across all vitest projects: one per layer kind (`domain`,
  `application`, `infrastructure`), each spanning every context
  (`packages/*/<layer>/**/*.test.ts`). Tests run against package sources, no build needed;
  `passWithNoTests` is on so a scaffolded context with no tests yet doesn't fail the run.
  Vitest project config lives in `vitest.config.ts` at the root.
- `npm run lint:arch` — run the hexagonal-architecture dependency-cruiser check (see
  Architecture below). First run `npm run lint:arch:setup` to install its isolated toolchain.
- `npm run clean` — `tsc -b --clean` plus removing `apps/desktop/out` and `apps/desktop/dist`.
- Per-app desktop commands (run with `npm -w apps/desktop run <script>` from root, or `npm run <script>` from `apps/desktop/`): `typecheck:node`, `typecheck:web` (split because main/preload and renderer use different tsconfigs), `build:unpack`/`build:win`/`build:mac`/`build:linux` (electron-builder packaging).
- Single test file: `npx vitest run packages/<context>/<layer>/path/to/file.test.ts`; one
  layer across all contexts: `npx vitest run --project domain`.

## Architecture

### Layout: bounded context → layer → role

Each package under `packages/` is one bounded context (currently only `auth`), and its
layers are folders inside it:

```
packages/<context>/
  package.json        @anytype-calendar/<context>, exports ./domain ./application ./infrastructure
  tsconfig.json       ONE tsconfig project for the whole context, `types: []`
  domain/             grouped by role: model/, gateways/, repositories/ (services/ when needed)
  application/        use cases, flat
  infrastructure/     driven adapters, grouped by technology: in-memory/, anytype/
  dist/<layer>/       tsc -b output (gitignored)
```

- From outside a context, import only its layer entry points:
  `@anytype-calendar/auth/domain`, `…/application`, `…/infrastructure`. Inside a context,
  layers import each other relatively through the barrel (`../domain`).
- Each layer's `index.ts` barrel is its public surface; add modules under the role /
  technology folders and re-export them there. Exported names carry their context
  (`AuthSession`, not `Session`) so the composition root can import from several contexts
  without collisions.
- `types: []` covers the whole context, so no layer can reach `process`, `fetch`,
  `setTimeout`, `console` and friends — dependency-cruiser only sees imports, not globals.
  Infrastructure that needs a platform capability takes it as an injected function from
  the composition root (`apps/desktop/src/main`).
- Adding a context: one `package.json`, one `tsconfig.json`, and a project reference in the
  root `tsconfig.json` and both `apps/desktop` tsconfigs, plus a dependency in
  `apps/desktop/package.json`. Aliases, vitest projects and lint rules are all
  pattern-based and need no edits.

### Hexagonal layering (enforced by `.dependency-cruiser.cjs`, run via `npm run lint:arch`)

```
packages/<ctx>/domain          -> nothing outside itself (no npm deps, no Node core)
packages/<ctx>/application     -> its own context's domain only (use cases / orchestration)
packages/<ctx>/infrastructure  -> its own context's domain only (driven adapters implementing domain ports)
apps/desktop                   -> any context's layers, plus Electron and React
```

Rules worth knowing before adding an import:
- A context's `domain` is the pure center — zero runtime dependencies of any kind. Both a
  general "no imports outside itself" rule and a dedicated "no npm/Node core deps" rule
  enforce this (the second exists purely for a clearer lint error).
- `application` is the use-case layer; adapters get wired in through domain-defined ports,
  not imported directly.
- `infrastructure` holds *driven* adapters (implementations of domain ports); it may only
  reach into its own `domain`.
- Contexts never import each other; the composition root in `apps/desktop/src/main` wires
  them together. The rules capture the context name and refer back to it (`$1`), so this
  holds for every context without a rule per package.
- No package may import from `apps/**` (dependencies point inward only) or from
  `electron`/`react`/`react-dom` (delivery mechanisms belong solely in `apps/desktop`).

Contexts are consumed **from source**, not from their built `dist/`, via one pattern alias
(`@anytype-calendar/<ctx>/<layer>` → `packages/<ctx>/<layer>/index.ts`) in both
`apps/desktop/electron.vite.config.ts` and root `vitest.config.ts` — so `npm run dev` and
`npm test` never require a prior `tsc -b`, and editing a package gets HMR in the running
app. `tsc -b` project references are what actually typechecks the packages (apps resolve
the entry points through each package's `exports` to its emitted declarations);
`tsconfig.paths.json` is a separate resolution-only config consumed by dependency-cruiser
so `lint:arch` doesn't need a build either.

### apps/desktop structure

Standard electron-vite three-process layout:
- `src/main` — Electron main process and the **composition root**. `composition.ts` is
  the only place adapters are chosen (currently the auth context's in-memory ones, which
  simulate Anytype: the accepted code is `2749`, and each challenge's code is logged to
  the terminal). `src/main/<context>/` holds that context's Electron-side driving adapter,
  e.g. `auth/auth-ipc.ts`, which registers the IPC handlers and pushes every session
  change to all windows. A `dev:*` channel is registered only when `is.dev`.
- `src/shared/ipc.ts` — the IPC contract used by all three processes: channel names, the
  `SessionSnapshot` the renderer receives (never carries the API key), and `CalendarApi`.
- `src/preload` — exposes `CalendarApi` to the renderer as `window.api` (plus
  `@electron-toolkit/preload`'s default API as `window.electron`). `index.d.ts` types
  `window.api` for the renderer too — `tsconfig.web.json` includes it.
- `src/renderer/src` — the React app:
  - `App.tsx` is the renderer root: screen switching, theme, and the *only* module that
    reads mock data (`mocks/index.ts`). Navigation is local `useState`, not a router — by
    design, since the flow is four fixed screens with no URLs. When real data arrives via
    IPC, only `App.tsx` should need to change.
  - `types/index.ts` holds UI-local view-model types (e.g. `CalendarEvent`, `ObjectType`,
    `Space`), deliberately kept out of the packages' domain layers — they describe what a
    component needs to draw, not what the calendar means. These get replaced/mapped once
    real domain types exist.
  - `screens/<flow>/` — one directory per screen (`auth`, `onboarding`, `config`, `month`),
    each with its own subcomponents.
  - `components/ui/` — presentational primitives (Button, Card, Dialog, Select, Tag, etc.),
    barrel-exported from `components/ui/index.ts`.
  - `components/app/` — app-level chrome (e.g. `FlowSwitcher`, the dev-only harness for
    jumping directly to any of the ten design frames — see `lib/frames.ts`).
  - `lib/frames.ts` — maps the ten named design "frames" (auth states, onboarding, config,
    month, detail) to/from renderer screen state; backs the `FlowSwitcher` dev harness.
  - `lib/calendar.ts` — calendar grid/date math for the month view.
  - `mocks/index.ts` — the only source of sample data; stands in for the eventual
    IPC-backed data layer.
  - Import convention: anything outside the importing file's own directory is reached
    through the `@renderer/*` alias (`@renderer/lib/calendar`), never `../..`;
    same-directory imports stay relative (`./EventChip`). The IPC contract is reached as
    `@shared/ipc` from every process. Each alias is declared in several places that must
    agree — `resolve.alias` in `electron.vite.config.ts` (used by `dev`/`build`), `paths`
    in `tsconfig.web.json` (and `tsconfig.node.json` for `@shared`; used by `typecheck`),
    and `paths` in the root `tsconfig.paths.json` (used by `lint:arch`; a missing entry
    there shows up as `not-to-unresolvable` errors, not as a build failure).

### Toolchain quirks (see `docs/deps-notes.md` for full detail)

- `electron` is pinned to an **exact** version (not a range) — electron-builder computes
  the packaged Electron version by reading `node_modules/electron`, which npm workspaces
  hoist to the repo root, and it cannot resolve a range there.
- `vite` is pinned to `^7` and `@vitejs/plugin-react` to `^5.2.0` — newer majors of either
  break the electron-vite/vite peer chain.
- The root `postinstall` explicitly runs `node node_modules/electron/install.js` — Electron
  44 dropped its own auto-download postinstall, and `electron-vite` reads
  `node_modules/electron/path.txt` directly rather than `require()`-ing the module, so the
  binary is never fetched lazily.
- `npm run lint:arch` deliberately shells out to a **separate, non-workspace** install at
  `tools/arch-lint/` (its own `node_modules` + lockfile, pinned to `typescript@6`).
  TypeScript 7 (used by the rest of the repo) ships no JS compiler API, which
  dependency-cruiser needs; keeping this toolchain outside the npm workspace prevents
  hoisting from re-exposing the root's TypeScript 7 to it. Do not try to fold this into the
  root `devDependencies` — see `tools/arch-lint/README.md` for the removal plan once
  dependency-cruiser supports TS 7.1.
- `apps/desktop`'s package name is deliberately unscoped (`anytype-calendar-desktop`, not
  `@anytype-calendar/desktop`) because electron-builder feeds the package name straight
  into artifact filenames and the Linux executable name; a scoped name would corrupt those.

## Working conventions observed in this repo

- Comments only say what the code cannot: why a choice was made, a non-obvious constraint
  or invariant, a unit (`/** Epoch milliseconds. */`), or an external fact such as an API
  endpoint or a platform quirk. Never write a comment that restates a name, a type or the
  body below it — `/** The number of digits in the code Anytype displays. */` above
  `AUTH_CODE_LENGTH = 4` adds nothing. If a comment is needed to say *what* something is,
  rename it instead. This applies to JSDoc on every export too; an undocumented function
  with a clear name and signature is the goal, not a gap.
- Layer `index.ts` barrels carry a one-line comment stating the layer's contract (what it
  may depend on) — keep that pattern when filling in currently-empty modules or adding a
  context.
- Prefer reading existing doc comments in a file before changing its behavior; several
  files (e.g. `App.tsx`, `lib/frames.ts`, `types/index.ts`, `.dependency-cruiser.cjs`)
  explain *why* a structural choice was made, not just what it does.
