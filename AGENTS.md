# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## What this is

An Electron + React desktop app that renders Anytype objects (with date properties) on a
calendar. It talks to the Anytype local API. npm workspaces monorepo, currently in an
early pass: the UI (`apps/desktop`) is fully built; the backend is being built as one
package per bounded context under `packages/`. `auth` is fully wired: it signs in against
the real Anytype local API, either through the challenge/code exchange or by pasting a key
the user already holds, and keeps the key across restarts. The connected session also says
which major of the API the app reads through and what the key was granted (its spaces, and
read or read/write), which Settings shows. `schema` — how the user
builds their event schema from their Anytype data — reads each space's dated types (types
with a user date property) and tracks the last sync, which feeds the post-sign-in success
card and onboarding. Under v2 a sync also reads each space's image, whether each type has
Anytype's own Done and Location, and its select properties' option colours. It also persists
the user's selection — which spaces and types go on the calendar, each type's From/To date
property, whether that type's dates carry a time of day, and which select property, if any,
colours its objects (`colourBy`) — which onboarding and Settings save.
`events` reads, for the span on screen — a month, a week or a day — the objects of the
selected types whose dates fall in it, with their Done, Location and colour-by option where
v2 serves them, which the calendar screen draws as a month grid or as an hour grid. No screen
runs on mock data.

## Commands

Run from the repo root unless noted.

- `npm run dev` — start the desktop app (electron-vite dev server + Electron).
  **Must** be run with `env -u ELECTRON_RUN_AS_NODE` set, e.g.
  `env -u ELECTRON_RUN_AS_NODE npm run dev` — otherwise Electron launches in Node mode and
  fails with a misleading `isPackaged` TypeError. Sign-in needs the Anytype desktop app
  running; add `ANYTYPE_CALENDAR_FAKE_AUTH=1` to run against a simulated Anytype instead —
  sign-in, the schema reads and the span's objects alike (see `composition.ts`). Against a
  real Anytype that serves API v2, `ANYTYPE_CALENDAR_API=v1` forces the v1 fallback (and
  `v2` forbids it). Only with a legacy key: v1 refuses a key paired through v2, and a refused
  key is signed out, which deletes it. There is deliberately no such setting in the UI.
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
- Per-app desktop commands (run with `npm -w apps/desktop run <script>` from root, or `npm run <script>` from `apps/desktop/`): `typecheck:node`, `typecheck:web` (split because main/preload and renderer use different tsconfigs), and `package`/`make` (Electron Forge, configured in `apps/desktop/forge.config.js`; the root scripts of the same names run `tsc -b` first). Forge writes to `apps/desktop/dist`, since electron-vite owns `out/`, and builds for the host OS only: a `.deb` on Linux, a Squirrel `Setup.exe` on Windows, a `.dmg` and `.zip` on macOS. Nothing is code-signed yet.
- Releasing: bump `apps/desktop/package.json`'s `version`, then push a matching `v<version>` tag. `.github/workflows/release.yml` creates a draft release, runs `make` on Linux, Windows and macOS runners, uploads each one's installers into it with `gh release upload`, and publishes it once all three have uploaded. Forge's GitHub publisher is not used: its retried uploads failed as duplicates. Running the workflow by hand only makes the installers, as workflow artifacts. Installed
  builds update themselves from those releases through update.electronjs.org
  (`src/main/updates/auto-update.ts`, `update-electron-app`): packaged Windows and macOS only,
  the repo must stay public, and macOS applies nothing until the app is code-signed.
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
error statuses as values and rejects only on transport failure (or a success that is not
JSON), and `fetch` is injected by the composition root. It also holds `AnytypeDialectProbe`,
which asks Anytype once per key which major of the API it serves (`GET /v2/auth/whoami`: an
answer means v2, a bare plain-text 404 means a build without v2). Each context's
`infrastructure/anytype/` has an `AnytypeV1*Gateway`, an `AnytypeV2*Gateway` and an
`Anytype*Gateway` that picks one of the two per call through the probe, so dropping v1 later
means deleting one file per context. A v2 adapter that meets the bare 404 calls
`probe.forget()`, and so does leaving the `connected` session. `kernel` holds `DispatchGuard`, the store-plus-reducer dispatch/
staleness-guard pattern every use case that races an async gateway call against a later
reset, step-back or newer request repeats (see `SubmitAuthCode`, `SyncSchema`,
`LoadEventsSpan`); it has only an
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
  needs that). Auth uses `AnytypeAuthGateway` against `http://127.0.0.1:31009` — it pairs
  through v2 where served (the user then picks the spaces and read/write access in Anytype)
  and v1 where not, exchanging a code with the major that issued its challenge — and keeps
  the key in `<userData>/credential.bin`, encrypted with `safeStorage`
  (`EncryptedFileCredentialRepository`). Without OS encryption it falls back to the
  in-memory repository; on Linux's `basic_text` backend it persists anyway, with a
  warning. Every context's Anytype gateway shares one `AnytypeClient`. Schema and events
  each read the key through their own port (`SchemaApiKeySource`, `EventsApiKeySource`),
  which the composition root adapts from auth's credential repository; events reads which
  types go on the calendar through `EventsSourceSelection`, adapted from schema's selection
  store (`events/event-sources.ts`: only the chosen types of chosen spaces; Done, Location and
  the colour-by property only where the last schema sync saw the type with them, since v2
  refuses a search `field` the type lacks), and places a
  span in the machine's time zone (`LocalEventsTimeZone`). The composition root is also
  where the contexts are linked: entering `connected` syncs the schema and loads the span on
  screen, and leaving it resets both (a session that stays connected — `access-checked`
  replacing its access — reads nothing again); a successful schema sync and every saved
  selection reload that span; and a window gaining focus re-runs both, at most once per 30 s
  (`events/events-ipc.ts`), along with `CheckAuthAccess`. That use case asks Anytype what the
  connected key reaches (`verifyApiKey`, which always re-asks the probe, so a grant changed in
  Anytype shows): it fills in `access` for a key restored at launch, where it starts `null`,
  and refreshes it on focus. The connected session's `access` is `{ apiVersion, grant }`; a
  null `grant` is a legacy key, or v1, which cannot say, and reaches every space with write
  access. `LoadEventsSpan` lets the
  newest load win, so leaving a span or changing Settings mid-load never draws a stale
  result. Before any load it opens on `defaultEventsSpan` (`events/default-span.ts`), built
  from the saved view and week start — which is why `main/index.ts` awaits those two
  preferences before restoring the session, the thing that starts that first load. `ANYTYPE_CALENDAR_FAKE_AUTH=1` swaps in `InMemoryAuthGateway` (accepted code
  `2749`, logged to the terminal, or the API key `ak_fake_2749` pasted directly), a
  separate `credential-fake.bin`,
  `InMemorySchemaGateway` (the design's four sample spaces) and `InMemoryEventsGateway`
  (the design's sample month, seeded around the current month; it ignores the window and
  returns every object of a source, as the port allows). The schema selection is plain
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
  renderer receives (none carries the API key), and `CalendarApi`. The span on screen is
  main's: `events.showSpan` asks for one (validated with `toEventsSpan`), and the
  `EventsSnapshot` pushed back says which span it holds. An `EventsSpan` is a discriminated
  union — `{ kind: 'month', year, month }`, or `{ kind: 'week' | 'day', start }` — so each
  kind carries only what pins it down and no two of its fields can disagree; its window
  (`eventsSpanWindow`) reads a month with a week of slack either side, enough to cover the
  grid's padding rows whichever day the week starts on.
- `src/preload` — exposes `CalendarApi` to the renderer as `window.api` (plus
  `@electron-toolkit/preload`'s default API as `window.electron`). `index.d.ts` types
  `window.api` for the renderer too — `tsconfig.web.json` includes it.
- `src/renderer/src` — the React app:
  - `App.tsx` is the renderer root: screen switching and theme. **Screens derive from the session**: until it is
    connected, the auth card shown is `authViewFor(session)` (`lib/session.ts`) of the
    snapshot main pushes (`hooks/useSession.ts`, over the generic `usePushedState`), and
    auth buttons only send intents over `window.api`. Once connected, navigation between success / onboarding / config / calendar
    is local `useState`, not a router — four fixed screens, no URLs. Entering `connected`
    lands on the success card when the window drew the sign-in; a window whose first
    snapshot is already connected (key restored at launch, or a reload) goes straight to
    the calendar. Never key this off the phase just before `connected`: pushes can be rendered
    together, so a transient phase like `verifying` may never be drawn. One rule overrides
    the local screen: until a selection is saved (`unset`), every screen past the success
    card is onboarding, so a restored key that never finished it still gets it. Continue
    saves the picks; Skip saves an empty selection on first run and saves nothing later.
    Settings (`screens/config`) saves each change as it is made, and `SaveSchemaSelection`
    runs those saves one at a time, in order. Both screens start their picks only once the
    account has been read: over no types, every saved date would fall back to a default.
    The calendar's arrows, Today and view switcher only ask main for a span, and
    `CalendarScreen` is keyed by the span main pushes back, so another span starts with no day
    selected and no panel open. Switching view saves the preference *and* asks for the new
    span in one handler: the preference is only what the next launch opens on, while
    `span.kind` is what this window draws. The new span is built around `switchDateFor` —
    today when the span on screen covers it, so switching from this month lands on this week,
    and otherwise the day the span is anchored on, so a reader of another month stays there.
    The theme toggle lives in the
    calendar's top bar only; other screens follow the system theme until it is used.
    The week-numbers preference (Settings → Calendar, off by default; ISO weeks) is saved like the
    theme, in the `weekNumbers` section of `app-config.json` (`main/week-numbers/`). The month grid
    draws it in a gutter beside each week row, never as a column of it: bars are positioned as
    `100% / 7` of that row. The first day of the week (Settings → Calendar, Monday by default) is
    saved the same way, in the `weekStart` section (`main/week-start/`), as an index with
    Monday 0 and Sunday 6; the grid, its headers and its weekend shading follow it, and a row's
    week number is that of its Thursday.
    The time format (Settings → Calendar, 24-hour by default) is saved likewise, in the `timeFormat`
    section (`main/time-format/`) as `'24h'` or `'12h'`. Times stay `HH:MM` in the view model;
    `formatTime` (`lib/calendar.ts`) draws them, reading the format from `TimeFormatContext`.
    The view a launch opens on (Settings → Calendar, the month by default) is saved the same
    way, in the `calendarView` section (`main/calendar-view/`) as `'month' | 'week' | 'day'` —
    the same three names an `EventsSpan`'s `kind` uses, so there is one vocabulary for them.
    The app is localized into English, Spanish and Galician (`react-i18next`, resources under
    `renderer/src/i18n/locales/`). The language (Settings → Calendar) follows the OS language
    by default: `LanguageSnapshot` (`main/language/`, saved in the `language` section of
    `app-config.json`) is `'en' | 'es' | 'gl' | null`, where `null` — the initial value, and
    "System default" in the Select — means "follow the OS", the same shape `ThemeSnapshot`
    uses for the OS theme. Unlike the theme, which reads `prefers-color-scheme` in CSS,
    resolving `null` to an actual locale needs a JS-visible value, so it happens in the
    renderer: `resolveLocale` (`lib/locale.ts`) matches `navigator.languages` against the three
    shipped locales, and `useLocale` (mirroring `useTheme`'s "follow the OS until overridden"
    shape) feeds the result to `i18next.changeLanguage`. Components read translations with
    `react-i18next`'s own `useTranslation`, not a bespoke context. The pure `lib/` modules
    (`calendar.ts`, `schema.ts`, `events.ts`) have no hook access, so they stay
    translation-free: `lib/calendar.ts`'s date/weekday/time formatting takes a `locale`
    argument and calls `Intl.DateTimeFormat` directly instead of a hardcoded English table.
    Electron bundles Chromium's own ICU data, not Node's, and unlike `es`, Chromium's copy
    carries no `gl` data at all (`Intl.DateTimeFormat.supportedLocalesOf` comes back empty for
    it) — every `Intl` call for Galician would otherwise silently draw in Chromium's default
    locale instead. `lib/calendar.ts` detects this (`supportsLocale`) and falls back to a
    small hardcoded Galician vocabulary table, checked against Node's own `Intl` output for
    `gl` (which, confusingly, *does* carry it) so the wording matches what real `Intl` would
    produce; `calendar-gl-fallback.test.ts` forces the fallback path by mocking
    `supportedLocalesOf`, since a plain test run — under Node — never takes it otherwise. And
    `lib/schema.ts`/`lib/events.ts`'s sync-status text (`elapsedSince`, `syncViewFor`,
    `spanStatusFor`) returns a `SyncDetail`/`Elapsed` shape that a component resolves to text
    with `syncDetailText` (`lib/sync-text.ts`). `Wordmark`'s brand text and the literal Anytype
    menu breadcrumb in `SessionSection`'s revoke instructions are deliberately left
    untranslated — a product name and another app's own UI labels, not this app's copy.
  - `lib/session.ts` is the only renderer module that reads a `SessionSnapshot`'s shape;
    components receive the UI-local `AuthView` instead. `lib/schema.ts` does the same for a
    `SchemaSnapshot` (`hooks/useSchemaSync.ts`) and a `SchemaSelectionSnapshot`
    (`hooks/useSchemaSelection.ts`): it turns them into `Space[]`, `ObjectType[]`, a
    `SyncView` and `TypePicks`, and turns picks back into the `SchemaSelection` to save.
    `lib/events.ts` does the same for an `EventsSnapshot` (`hooks/useEvents.ts`): the span
    on screen, its status, and its objects as `CalendarEvent`s in local `YYYY-MM-DD` dates
    and `HH:MM` times, keyed to their `ObjectType` with `lib/schema.ts`'s `objectTypeKey`.
    A result kept from another span is never drawn on this one. It also owns the span algebra
    the renderer needs: `spanFor` (the span a view wants around a date), `anchorOf` (the date
    a span is anchored on — the first of a month, the first day of a week, the day itself),
    `shiftSpan` (one step in the span's own units) and `switchDateFor`.
  - `types/index.ts` holds UI-local view-model types (e.g. `AuthView`, `CalendarEvent`,
    `ObjectType`, `Space`), deliberately kept out of the packages' domain layers — they
    describe what a component needs to draw, not what the calendar means.
  - `screens/<flow>/` — one directory per screen (`auth`, `onboarding`, `config`, `calendar`),
    each with its own subcomponents. `screens/calendar` holds all three views: `CalendarScreen`
    keeps the chrome and switches on `span.kind` between `MonthGrid` and `TimeGrid`, and
    `TimeGrid` serves the week and the day alike — they differ only in how many columns it
    draws, so it takes `days: DayColumn[]`, seven of them or one.
  - `components/ui/` — presentational primitives (Button, Card, Dialog, Select, Tag, etc.),
    barrel-exported from `components/ui/index.ts`.
  - `components/app/` — app-level chrome shared across screens (`Wordmark`,
    `SpaceMonogram`, `TypeTile`). Only types carry a hue: their Anytype icon colour, one
    category hue per each of Anytype's ten (`lib/schema.ts`). Anytype gives spaces no
    colour, so a space is marked by its initial in neutral ink.
  - `lib/calendar.ts` — calendar grid/date math for every view, over local `YYYY-MM-DD`
    dates, which compare in order as strings: `buildMonthGrid`, `buildWeek`, `addDays`, and
    the `monthLabel`/`weekLabel`/`dayLabel` formatters. `weekLabel` uses
    `Intl.DateTimeFormat`'s `formatRange`, which says only what changes between the two dates
    — the month once inside one, twice across two, the year twice only across New Year — in
    the locale's own order.
  - `lib/month-layout.ts` — where a week's objects are drawn: one segment per object per
    week (`layOutWeek`), so a range is one continuous bar from its first day to its last,
    cut only at a week's edges — a month is read with a week of slack either side, so the days
    a row borrows from the adjacent months carry their objects too, dimmed but drawn, and a
    cut side is squared off and runs flush. The week view's all-day band reuses it with a
    higher lane cap: the same problem, one row of it. Segments
    are packed into lanes so a bar keeps one vertical slot all week; past `MAX_LANES` an
    object is dropped and counted in the `+N more` of each day it covers. The bar is drawn
    by the cell its segment starts in, keeping the grid's rows and cells intact, but is
    positioned against the week row, whose columns it has to span (`event-span` in
    `styles/index.css`, which reads `--columns` and `--lane-top` from the row it sits in, so
    the same utility serves a seven-column month row and a one-column day band).
  - `lib/time-grid.ts` — where the week and day views put a day's timed objects.
    `splitDayEvents` first sends everything an hour grid cannot place to the all-day band:
    all-day objects, and ranges crossing midnight, which belong to several days at once and
    read better as one bar across them. `layOutDayColumn` then places the rest by the minute
    and packs overlapping ones into columns — a run of transitively overlapping objects is
    sized together, so a bar keeps one width throughout, though an object clear of an earlier
    one reuses the column it freed. An object with no To date is a moment, drawn at
    `MIN_SLOT_MINUTES`, not something running on to midnight.
  - Import convention: anything outside the importing file's own directory is reached
    through the `@renderer/*` alias (`@renderer/lib/calendar`), never `../..`;
    same-directory imports stay relative (`./EventChip`). The IPC contract is reached as
    `@shared/ipc` from every process. Each alias is declared in several places that must
    agree — `resolve.alias` in `electron.vite.config.ts` (used by `dev`/`build`), `paths`
    in `tsconfig.web.json` (and `tsconfig.node.json` for `@shared`; used by `typecheck`),
    and `paths` in the root `tsconfig.paths.json` (used by `lint:arch`; a missing entry
    there shows up as `not-to-unresolvable` errors, not as a build failure).

### Anytype local API facts the adapters rely on

v1 facts, checked against a real account on API version `2025-11-08`:
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

v2 (pre-release: it may change without a new version; spec at
`https://developers.anytype.io/openapi-v2.yaml`), checked against a real account in September
2026. The same process and port serve both majors, so a v2 build still serves v1, and a legacy
key works with both; a key paired through v2 (scoped) does not work with v1:
- Spaces are served by a six-character short reference unless `?ids=full` is asked for; the
  adapters always ask, since the saved selection stores full ids. Both spellings are accepted
  back. The list holds only the key's granted spaces, never the tech space, and says nothing
  of a space's kind, so one-to-one chats cannot be left out. Its top-level
  `has_not_granted_spaces` says the grant leaves some of the account's spaces out; the schema
  sync carries it as `hasNotGrantedSpaces`, and onboarding and Settings show a hint for it.
- `GET /v2/auth/whoami?ids=full&spaces=true` describes the key: `grant { scoped, restricted,
  all_spaces, permission, spaces[{ id, name, permission }] }` and `key_status`. A legacy key
  (issued before grants) answers `scoped: false`, `permission: null`, `key_status: "legacy"`;
  a restricted one lists its spaces; an all-spaces grant lists every live space too, which is
  not its boundary. Pairing answers `grant { all_spaces, space_ids, permission: 'read' |
  'readwrite' }`, or null. `api.version` says `2025-11-08` even over v2, so it is never shown.
- A type list row is only `{ key, name }`; the icon and properties are in the type document
  (`GET …/types/{key}`: `icon`, `type_settings.property_definitions[{ property, internal_key,
  name, format }]`). That document spells `lastOpenedDate` in camelCase, where every other
  route says `last_opened_date`. Done is the bundled `done` (checkbox) and Location the
  bundled `location` (text); a user property of the same name is not them.
- A select's options are `GET …/properties/{key}/options` → `{ name, color }`, space-wide and
  with no id: a search row names the picked option by its name, as a list (`["P4"]`). v1 has
  no such route, so `colourBy` is offered only under v2. `color` is one of the same ten names
  type icons use, drawn with the same hues (`hueOf`, `lib/schema.ts`).
- A space row may carry `icon_image`, a file id: `GET …/files/{id}/content?width=64` answers
  the image's bytes (PNG seen). `AnytypeClient.download` reads it through the injected
  `fetchBytes`; the v2 schema gateway turns it into a `data:` URL (Base64 injected by the
  composition root), cached by file id since a changed image gets a new id. The renderer's
  CSP allows `img-src data:` for it.
- **Keys differ from v1's where a user's type or property collides with one Anytype bundles**
  (a user "Book" type, a "Status" property): v1 serves the slug (`book`), v2 the internal key
  (`6a67272659c08021576f3127`), and v2 refuses the slug as `ambiguous_input`. Both majors
  accept the internal key as input, but each serves its own spelling in rows. The type
  document keeps v1's type key as `type_settings.api_key`; a property's v1 key is known only
  to v1, matched by name. `rekeySchemaSelection` rewrites a v1-saved selection after each
  sync (`formerKey` on types and date properties).
- Search takes `{ type, filters, fields }`. Structured `filters` use the long condition names
  (`greater_or_equal`, `not_empty` …) and dates as **unix seconds**, and still round date
  comparisons out to whole local days; `less_or_equal` still matches an empty date. The
  compact `filter` string cannot spell a key that starts with a digit, as internal keys may,
  so the adapters do not use it. Rows are `{ id, name, type, properties: { [key]: value } }`
  with only the `fields` asked for: a date is a bare RFC 3339 string, and one the object has
  no value for is left out — so is an unticked Done, read as not done.
- An unknown type key or a `fields`/filter key the type lacks answers 400, a space not open
  404, a space outside the key's grant 403 `space_not_granted`: all read as "no objects". A
  403 on a space's types, or on one type, reads as no types: the grant changed since the list.
- Paging puts `has_more`, `total` and a `message` hint at the top level. v2's own errors are
  `{ status, code, message, issues[] }`; pairing, key and rate-limit refusals keep v1's shape.

### Toolchain quirks (see `docs/deps-notes.md` for full detail)

- The packaged app ships no `node_modules`: main and preload bundle every dependency
  (`externalizeDeps: false` in `electron.vite.config.ts`), and `forge.config.js` packages
  only `out/`, `resources/` and `package.json`. npm workspaces hoist `node_modules` out of
  `apps/desktop`, so Forge could not assemble them anyway. A dependency that cannot be
  bundled (a native module) would need that revisited.
- The root `overrides` replace two of Forge 7's transitive dependencies: `@electron/rebuild`
  goes to `^4`, since 3.x pulls `@electron/node-gyp` from git, which npm 12 refuses to fetch;
  `yauzl` goes to `^3.4`, since on the 2.x that `@electron/packager` 18's `extract-zip` asks
  for, unzipping Electron stops partway on Node 26 and `package` exits 0 having produced
  nothing. Re-check both when upgrading Forge.
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
  `@anytype-calendar/desktop`) because Forge's makers derive the deb package name
  and Squirrel's package id from it, and a scoped name would corrupt those. Squirrel's id
  is also spelled out in `squirrelAppUserModelId` (`src/main/squirrel-startup.ts`), so
  renaming the package means updating that too.

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
