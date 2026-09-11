# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## What this is

An Electron + React desktop app that renders Anytype objects (with date properties) on a
calendar. It talks to the Anytype local API. npm workspaces monorepo, currently in an
early pass: the UI (`apps/desktop`) is fully built against mock data; the real domain,
use-case, and Anytype-adapter layers (`packages/*`) are scaffolded but largely empty
(`export {}` placeholders), with wiring left for a later pass.

## Commands

Run from the repo root unless noted.

- `npm run dev` — start the desktop app (electron-vite dev server + Electron).
  **Must** be run with `env -u ELECTRON_RUN_AS_NODE` set, e.g.
  `env -u ELECTRON_RUN_AS_NODE npm run dev` — otherwise Electron launches in Node mode and
  fails with a misleading `isPackaged` TypeError.
- `npm run build` — `tsc -b` (typecheck + build all package project references) then build
  the desktop app.
- `npm run typecheck` — `tsc -b --force` across the whole monorepo (all project references).
- `npm test` — `vitest run` across all vitest projects (currently `packages/domain` and
  `packages/application`; each package's tests run against its own `src`, no build needed).
  Vitest project config lives in `vitest.config.ts` at the root.
- `npm run lint:arch` — run the hexagonal-architecture dependency-cruiser check (see
  Architecture below). First run `npm run lint:arch:setup` to install its isolated toolchain.
- `npm run clean` — `tsc -b --clean` plus removing `apps/desktop/out` and `apps/desktop/dist`.
- Per-app desktop commands (run with `npm -w apps/desktop run <script>` from root, or `npm run <script>` from `apps/desktop/`): `typecheck:node`, `typecheck:web` (split because main/preload and renderer use different tsconfigs), `build:unpack`/`build:win`/`build:mac`/`build:linux` (electron-builder packaging).
- Single test file: `npx vitest run packages/domain/src/index.test.ts` (or point at any `*.test.ts`).

## Architecture

### Hexagonal layering (enforced by `.dependency-cruiser.cjs`, run via `npm run lint:arch`)

```
packages/domain        -> nothing (no npm deps, no Node core, no other package)
packages/application    -> domain only (use cases / orchestration)
packages/anytype        -> domain only (driven adapter: implements domain ports against the Anytype local API)
apps/desktop            -> domain + application + anytype, plus Electron and React
```

Rules worth knowing before adding an import:
- `packages/domain` is the pure center — zero runtime dependencies of any kind. Both a
  general "no imports outside itself" rule and a dedicated "no npm/Node core deps" rule
  enforce this (the second exists purely for a clearer lint error).
- `packages/application` is the use-case layer; adapters get wired in through domain-defined
  ports, not imported directly.
- `packages/anytype` is a *driven* adapter (implements domain ports); it may only reach into
  `domain`.
- No package may import from `apps/**` (dependencies point inward only) or from
  `electron`/`react`/`react-dom` (delivery mechanisms belong solely in `apps/desktop`).
- Each package's public surface is its `src/index.ts` barrel — add new modules under
  `event/`, `mapping/`, `layout/`, `ports/` (domain) etc. and re-export them there.

Workspace packages (`@anytype-calendar/domain`, `@anytype-calendar/application`,
`@anytype-calendar/anytype`) are consumed **from source**, not from their built `dist/`,
via aliases set up in both `apps/desktop/electron.vite.config.ts` and root
`vitest.config.ts` — so `npm run dev` and `npm test` never require a prior `tsc -b`, and
editing a package gets HMR in the running app. `tsc -b` project references are what
actually typechecks the packages; `tsconfig.paths.json` is a separate resolution-only
config consumed by dependency-cruiser so `lint:arch` doesn't need a build either.

### apps/desktop structure

Standard electron-vite three-process layout:
- `src/main` — Electron main process (window creation). Intended to become the composition
  root once packages are wired in (per `.dependency-cruiser.cjs` comments), but does not
  import any workspace package yet.
- `src/preload` — context-bridge preload script; currently exposes only `@electron-toolkit/preload`'s default API, no app-specific IPC yet.
- `src/renderer/src` — the React app:
  - `App.tsx` is the renderer root: screen switching, theme, and the *only* module that
    reads mock data (`mocks/index.ts`). Navigation is local `useState`, not a router — by
    design, since the flow is four fixed screens with no URLs. When real data arrives via
    IPC, only `App.tsx` should need to change.
  - `types/index.ts` holds UI-local view-model types (e.g. `CalendarEvent`, `ObjectType`,
    `Space`), deliberately kept out of `packages/domain` for now — they describe what a
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
    same-directory imports stay relative (`./EventChip`). The alias is declared three
    times and all three must agree — `resolve.alias` in `electron.vite.config.ts` (used by
    `dev`/`build`), `paths` in `tsconfig.web.json` (used by `typecheck`), and `paths` in
    the root `tsconfig.paths.json` (used by `lint:arch`; a missing entry there shows up as
    `not-to-unresolvable` errors, not as a build failure).

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

- Package `index.ts` barrels carry a comment describing the layer's contract (what it may
  depend on) — keep that pattern when filling in currently-empty modules.
- Prefer reading existing doc comments in a file before changing its behavior; several
  files (e.g. `App.tsx`, `lib/frames.ts`, `types/index.ts`, `.dependency-cruiser.cjs`)
  explain *why* a structural choice was made, not just what it does.
