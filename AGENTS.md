# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## What this is

An Electron + React desktop app that renders Anytype objects (with date properties) on a
calendar. It talks to the Anytype local API. npm workspaces monorepo, currently in an
early pass: the UI (`apps/desktop`) is fully built; the backend is being built as one
package per bounded context under `packages/`. `auth` is fully wired: it signs in against
the real Anytype local API, either through the challenge/code exchange or by pasting a key
the user already holds, and keeps the key across restarts. `schema` — how the user
builds their event schema from their Anytype data — reads each space's dated types (types
with a user date property) and tracks the last sync, which feeds the post-sign-in success
card and onboarding. It also persists the user's
selection — which spaces and types go on the calendar, each type's From/To date property,
and whether that type's dates carry a time of day — which onboarding and Settings save.
`events` reads, for the month on screen, the objects of the selected types whose dates fall
in it, which the month screen draws. No screen runs on mock data.

## Commands

Run from the repo root unless noted.

- `npm run dev` — start the desktop app (electron-vite dev server + Electron).
  **Must** be run with `env -u ELECTRON_RUN_AS_NODE` set, e.g.
  `env -u ELECTRON_RUN_AS_NODE npm run dev` — otherwise Electron launches in Node mode and
  fails with a misleading `isPackaged` TypeError. Sign-in needs the Anytype desktop app
  running; add `ANYTYPE_CALENDAR_FAKE_AUTH=1` to run against a simulated Anytype instead —
  sign-in, the schema reads and the month's objects alike (see `composition.ts`).
- `npm run build` — `tsc -b` (typecheck + build all package project references) then build
  the desktop app.
- `npm run typecheck` — `tsc -b --force` across the whole monorepo (all project references).
- `npm test` — `vitest run` across all vitest projects: one per layer kind (`domain`,
  `application`, `infrastructure`), each spanning every context
  (`packages/*/<layer>/**/*.test.ts`), plus `renderer` (the renderer's pure `lib/`
  modules) and `main` (the main process's pure glue, e.g. `events/focus-refresh.ts`, which
  must import neither Electron nor Node core). Tests run against package sources, no build needed;
  `passWithNoTests` is on so a scaffolded context with no tests yet doesn't fail the run.
  Vitest project config lives in `vitest.config.ts` at the root.
- `npm run lint:arch` — run the hexagonal-architecture dependency-cruiser check (see
  Architecture below). First run `npm run lint:arch:setup` to install its isolated toolchain.
- `npm run clean` — `tsc -b --clean` plus removing `apps/desktop/out` and `apps/desktop/dist`.
- Per-app desktop commands (run with `npm -w apps/desktop run <script>` from root, or `npm run <script>` from `apps/desktop/`): `typecheck:node`, `typecheck:web` (split because main/preload and renderer use different tsconfigs), `build:unpack`/`build:win`/`build:mac`/`build:linux` (electron-builder packaging). `build:win` needs Wine (electron-builder shells out to it for the NSIS installer and exe icon); on a Linux machine without Wine installed, use `build:win:docker` instead, which runs the packaging step in `electronuserland/builder:wine` via `build-win-docker.sh` — needs Docker, not Wine.
- Single test file: `npx vitest run packages/<context>/<layer>/path/to/file.test.ts`; one
  layer across all contexts: `npx vitest run --project domain`.

## Architecture

### Layout: bounded context → layer → role

Each package under `packages/` is one bounded context (currently `auth`, `schema` and `events`), and its
layers are folders inside it — except `anytype-client` and `kernel` (see below):

```
packages/<context>/
  package.json        @anytype-calendar/<context>, exports ./domain ./application ./infrastructure
  tsconfig.json       ONE tsconfig project for the whole context, `types: []`
  domain/             grouped by role: model/, gateways/, repositories/ (services/ when needed)
  application/        use cases, flat
  infrastructure/     driven adapters, grouped by technology: in-memory/, anytype/, encrypted-file/, local-time/
  dist/<layer>/       tsc -b output (gitignored)
```

`packages/anytype-client` and `packages/kernel` are not contexts but shared packages, each
with only one layer, so the pattern-based aliases, vitest projects and lint rules apply to
them unedited. `anytype-client` is the HTTP transport for the Anytype local API
(`AnytypeClient`) that every context's `infrastructure/anytype/` adapters use; it resolves
error statuses as values and rejects only on transport failure, and `fetch` is injected by
the composition root. `kernel` holds `DispatchGuard`, the store-plus-reducer dispatch/
staleness-guard pattern every use case that races an async gateway call against a later
reset, step-back or newer request repeats (see `SubmitAuthCode`, `SyncSchema`,
`LoadEventsMonth`); it has only an
`application/` layer and, unlike a context's own `application`, must import nothing at all
— not even Node core or npm — since it is meant to be safely importable from *any*
context's `application` layer without adding a dependency edge of its own
(`kernel-is-pure` in `.dependency-cruiser.cjs`).

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
  pattern-based and need no edits. A context whose adapters use `anytype-client` also
  lists it as a dependency and references `../anytype-client` from its tsconfig, as `auth`
  does; likewise for `kernel` in a context's `application` layer (`auth`, `schema` and
  `events` all do). Either way, run `npm install` afterward so npm workspaces symlinks the new package
  into `node_modules` — without it, `tsc -b` fails with `TS2307: Cannot find module`.

### Hexagonal layering (enforced by `.dependency-cruiser.cjs`, run via `npm run lint:arch`)

```
packages/<ctx>/domain          -> nothing outside itself (no npm deps, no Node core)
packages/<ctx>/application     -> its own context's domain, plus kernel (use cases / orchestration)
packages/<ctx>/infrastructure  -> its own context's domain, plus anytype-client (driven adapters implementing domain ports)
apps/desktop                   -> any context's layers, plus Electron and React
```

Rules worth knowing before adding an import:
- A context's `domain` is the pure center — zero runtime dependencies of any kind. Both a
  general "no imports outside itself" rule and a dedicated "no npm/Node core deps" rule
  enforce this (the second exists purely for a clearer lint error).
- `application` is the use-case layer; adapters get wired in through domain-defined ports,
  not imported directly. It may also reach into `packages/kernel/application` for shared
  use-case plumbing (currently just `DispatchGuard`); the same rule keeps `kernel` itself a
  leaf that imports no context, and a separate `kernel-is-pure` rule additionally forbids
  it from importing anything at all, context or otherwise.
- `infrastructure` holds *driven* adapters (implementations of domain ports); it may only
  reach into its own `domain` and `packages/anytype-client/infrastructure`. The same rule
  keeps `anytype-client` itself a leaf that imports no context.
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
  the only place adapters are chosen, and must run after `app` is ready (`safeStorage`
  needs that). Auth uses `AnytypeAuthGateway` against `http://127.0.0.1:31009`, and keeps
  the key in `<userData>/credential.bin`, encrypted with `safeStorage`
  (`EncryptedFileCredentialRepository`). Without OS encryption it falls back to the
  in-memory repository; on Linux's `basic_text` backend it persists anyway, with a
  warning. Every context's Anytype gateway shares one `AnytypeClient`. Schema and events
  each read the key through their own port (`SchemaApiKeySource`, `EventsApiKeySource`),
  which the composition root adapts from auth's credential repository; events reads which
  types go on the calendar through `EventsSourceSelection`, adapted from schema's selection
  store (`events/event-sources.ts`: only the chosen types of chosen spaces), and places a
  month in the machine's time zone (`LocalEventsTimeZone`). The composition root is also
  where the contexts are linked: every auth session change either syncs the schema and
  loads the month on screen (`connected`) or resets both (anything else); a successful
  schema sync and every saved selection reload that month; and a window gaining focus
  re-runs both, at most once per 30 s (`events/events-ipc.ts`). `LoadEventsMonth` lets the
  newest load win, so leaving a month or changing Settings mid-load never draws a stale
  result. `ANYTYPE_CALENDAR_FAKE_AUTH=1` swaps in `InMemoryAuthGateway` (accepted code
  `2749`, logged to the terminal, or the API key `ak_fake_2749` pasted directly), a
  separate `credential-fake.bin`,
  `InMemorySchemaGateway` (the design's four sample spaces) and `InMemoryEventsGateway`
  (the design's sample month, seeded around the current month). The schema selection is plain
  JSON in `<userData>/schema-selection.json` (`schema-selection-fake.json` in fake mode,
  since the fake space ids are not real ones), loaded alongside the key before the first
  window opens. A missing or unreadable file means onboarding was never done. The local API cannot revoke
  keys, so there is no revoke action: users delete keys in Anytype's settings.
  `src/main/<context>/` holds that context's Electron-side glue: e.g. `auth/auth-ipc.ts`,
  `schema/schema-ipc.ts` and `events/events-ipc.ts` register the IPC handlers and push
  every state change to all windows, and `auth/credential-storage.ts` and `schema/selection-storage.ts` adapt
  `safeStorage` and the filesystem (`atomic-file.ts`) to the repositories' injected ports.
- `src/shared/ipc.ts` — the IPC contract used by all three processes: channel names, the
  `SessionSnapshot`, `SchemaSnapshot`, `SchemaSelectionSnapshot` and `EventsSnapshot` the
  renderer receives (none carries the API key), and `CalendarApi`. The month on screen is
  main's: `events.showMonth` asks for one (validated with `toEventsMonth`), and the
  `EventsSnapshot` pushed back says which month it holds.
- `src/preload` — exposes `CalendarApi` to the renderer as `window.api` (plus
  `@electron-toolkit/preload`'s default API as `window.electron`). `index.d.ts` types
  `window.api` for the renderer too — `tsconfig.web.json` includes it.
- `src/renderer/src` — the React app:
  - `App.tsx` is the renderer root: screen switching and theme. **Screens derive from the session**: until it is
    connected, the auth card shown is `authViewFor(session)` (`lib/session.ts`) of the
    snapshot main pushes (`hooks/useSession.ts`, over the generic `usePushedState`), and
    auth buttons only send intents over `window.api`. Once connected, navigation between success / onboarding / config / month
    is local `useState`, not a router — four fixed screens, no URLs. Entering `connected`
    lands on the success card when the window drew the sign-in; a window whose first
    snapshot is already connected (key restored at launch, or a reload) goes straight to
    month. Never key this off the phase just before `connected`: pushes can be rendered
    together, so a transient phase like `verifying` may never be drawn. One rule overrides
    the local screen: until a selection is saved (`unset`), every screen past the success
    card is onboarding, so a restored key that never finished it still gets it. Continue
    saves the picks; Skip saves an empty selection on first run and saves nothing later.
    Settings (`screens/config`) saves each change as it is made, and `SaveSchemaSelection`
    runs those saves one at a time, in order. Both screens start their picks only once the
    account has been read: over no types, every saved date would fall back to a default.
    The month's arrows and Today only ask main for a month, and `MonthScreen` is keyed by
    the month main pushes back, so another month starts with no day selected and no panel
    open. The theme toggle lives in the
    month view's top bar only; other screens follow the system theme until it is used.
  - `lib/session.ts` is the only renderer module that reads a `SessionSnapshot`'s shape;
    components receive the UI-local `AuthView` instead. `lib/schema.ts` does the same for a
    `SchemaSnapshot` (`hooks/useSchemaSync.ts`) and a `SchemaSelectionSnapshot`
    (`hooks/useSchemaSelection.ts`): it turns them into `Space[]`, `ObjectType[]`, a
    `SyncView` and `TypePicks`, and turns picks back into the `SchemaSelection` to save.
    `lib/events.ts` does the same for an `EventsSnapshot` (`hooks/useEvents.ts`): the month
    on screen, its status, and its objects as `CalendarEvent`s in local `YYYY-MM-DD` dates
    and `HH:MM` times, keyed to their `ObjectType` with `lib/schema.ts`'s `objectTypeKey`.
    A result kept from another month is never drawn on this one.
  - `types/index.ts` holds UI-local view-model types (e.g. `AuthView`, `CalendarEvent`,
    `ObjectType`, `Space`), deliberately kept out of the packages' domain layers — they
    describe what a component needs to draw, not what the calendar means.
  - `screens/<flow>/` — one directory per screen (`auth`, `onboarding`, `config`, `month`),
    each with its own subcomponents.
  - `components/ui/` — presentational primitives (Button, Card, Dialog, Select, Tag, etc.),
    barrel-exported from `components/ui/index.ts`.
  - `components/app/` — app-level chrome shared across screens (`Wordmark`,
    `SpaceMonogram`, `TypeTile`). Only types carry a hue: their Anytype icon colour, one
    category hue per each of Anytype's ten (`lib/schema.ts`). Anytype gives spaces no
    colour, so a space is marked by its initial in neutral ink.
  - `lib/calendar.ts` — calendar grid/date math for the month view, over local
    `YYYY-MM-DD` dates, which compare in order as strings. A range is drawn on every day of
    the month it covers, clipped at the month's edges; outside days draw no objects.
  - Import convention: anything outside the importing file's own directory is reached
    through the `@renderer/*` alias (`@renderer/lib/calendar`), never `../..`;
    same-directory imports stay relative (`./EventChip`). The IPC contract is reached as
    `@shared/ipc` from every process. Each alias is declared in several places that must
    agree — `resolve.alias` in `electron.vite.config.ts` (used by `dev`/`build`), `paths`
    in `tsconfig.web.json` (and `tsconfig.node.json` for `@shared`; used by `typecheck`),
    and `paths` in the root `tsconfig.paths.json` (used by `lint:arch`; a missing entry
    there shows up as `not-to-unresolvable` errors, not as a build failure).

### Anytype local API facts the adapters rely on

Checked against a real account on API version `2025-11-08`:
- A date property's value is `{ key, format: 'date', date: '2026-09-13T22:00:00Z' }`:
  RFC 3339, always UTC, no zone of its own. A property the object has no value for is left
  out of `properties` altogether.
- Nothing marks a date as date-only. One set without a time is stored as the first instant
  of that day where it was set (22:00 UTC for a day in UTC+2), so `toEventsDatedObject`
  reads a date on the first instant of a local day as all-day.
- Search filter conditions are the short names — `eq`, `ne`, `gt`, `gte`, `lt`, `lte`,
  `empty`, `nempty` … — not the long ones the OpenAPI enum lists, which answer 400. A
  date condition takes `date` as RFC 3339 or `YYYY-MM-DD`, and compares by whole local
  days: `gte` rounds to the start of its day, `lte` to the end. So date filters only
  narrow a search; the exact overlap is checked in the domain. `lte` also matches an empty
  date, hence `nempty` beside it. `{ operator, conditions, filters }` nests `and`/`or`
  groups.
- A filter on a property key the space does not have answers 400 (`failed to build
  expression filters`); an unknown type key or space id answers an empty page.
- Paging is `?offset=&limit=` (at most 1000) with `pagination.has_more`.

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
  files (e.g. `App.tsx`, `lib/session.ts`, `types/index.ts`, `.dependency-cruiser.cjs`)
  explain *why* a structural choice was made, not just what it does.
