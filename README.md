# Calendar for Anytype

A desktop calendar for [Anytype](https://anytype.io). It reads objects from your local
Anytype account through the local API and lays the ones carrying date properties onto a
month grid — so a `Task` with a due date, a `Meeting` with a start and end, and a `Note`
with a creation date all show up in one place, without leaving your data or moving it
anywhere.

You pick which spaces and object types to track, and which date property of each type
anchors it on the grid (a type with both a start and an end property is drawn as a range).

> **Status: early.** The desktop UI is fully built and navigable. `auth` is fully wired: it
> signs in against the real Anytype local API, either through the 4-digit challenge/code
> flow or by pasting a key you already hold, and keeps the key, encrypted, across restarts.
> `schema` is real too — it reads each space's dated types from your Anytype data and feeds
> the post-sign-in success card, onboarding, and Settings, which save which spaces/types you
> track and each type's From/To date property. `events` puts those types' objects on the
> month grid: any month can be browsed, a type with a To date is drawn as one continuous bar
> across the days it spans, the event detail panel can open the object in Anytype, and the
> month is read again when you come back to the window. The app remembers your light/dark
> choice across restarts. The installers are packaged with Electron Forge and published from
> a GitHub Actions release workflow. Editing, week and day views, and recurrence are not
> built yet. The backend is organised as one package per bounded context — `auth`, `schema`
> and `events` so far — plus two shared packages, `anytype-client` (the local API HTTP
> transport) and `kernel` (shared use-case plumbing).

## Requirements

- Node.js ≥ 26.8.1 and npm ≥ 12.0.2 (both pinned via [Volta](https://volta.sh) in
  `package.json`; Volta will pick them up automatically if installed)
- Anytype desktop, running, to sign in (or use the simulated one, below)

## Getting started

```sh
npm install
env -u ELECTRON_RUN_AS_NODE npm run dev
```

`npm install` also fetches the Electron binary and installs the isolated architecture-lint
toolchain, via the root `postinstall`.

**The `env -u ELECTRON_RUN_AS_NODE` prefix matters.** If that variable is set in your shell
(some editors and terminal integrations set it), Electron starts in plain Node mode and
`npm run dev` dies with a misleading `TypeError` about `isPackaged`.

The app opens on the auth screen. Start the connection and Anytype shows a 4-digit code;
type it into the app. If you already hold an API key (from a previous session, or minted
directly in Anytype under Settings → API Keys), you can paste it instead of running the
code flow. The key is then stored in the app's user-data directory
(`~/.config/anytype-calendar-desktop/credential.bin` in dev on Linux), encrypted with the
OS keychain through Electron's `safeStorage`. Once connected, the app reads your spaces'
dated types and walks you through onboarding — which spaces and types to track, and each
type's From/To date property — or reopens straight past it if you'd already done that on a
previous run. The calendar then shows the current month's objects of the types you picked:
a type with a To date is drawn as one continuous bar across the days it spans, and clicking
into a day opens the event detail panel, which can open the object directly in Anytype.
Dates without a time are drawn as all-day, and times are shown in your computer's time
zone. The month view's top bar also has a light/dark theme toggle, remembered across
restarts. Signing out deletes the credential file. The local API cannot revoke a key,
so to revoke one, delete it in the Anytype app under Settings → API Keys.

To work without Anytype, sign in against a simulated one:

```sh
env -u ELECTRON_RUN_AS_NODE ANYTYPE_CALENDAR_FAKE_AUTH=1 npm run dev
```

The terminal then logs each challenge and the code to type — always `2749` (or paste the
API key `ak_fake_2749` directly). The simulated key is kept in a separate
`credential-fake.bin`, the schema comes from four sample spaces
`InMemorySchemaGateway` builds, and the objects from a sample month `InMemoryEventsGateway`
seeds around the current one — never anything from a real Anytype instance.

## Scripts

Run from the repo root.

| Command | What it does |
| --- | --- |
| `npm run dev` | electron-vite dev server + Electron, with HMR (see the env note above) |
| `npm run build` | `tsc -b` across all packages, then build the desktop app |
| `npm run typecheck` | `tsc -b --force` over the whole monorepo |
| `npm test` | `vitest run`: one project per layer (`domain`, `application`, `infrastructure`) across all contexts, plus the desktop app's `renderer` and `main` |
| `npm run lint:arch` | dependency-cruiser check of the hexagonal layering |
| `npm run lint:arch:setup` | install the arch-lint toolchain (only if `postinstall` was skipped) |
| `npm run clean` | `tsc -b --clean` plus the desktop app's `out/` and `dist/` |
| `npm run package` / `make` / `publish` | package, build installers for, or publish to GitHub the desktop app for this OS with Electron Forge, into `apps/desktop/dist` |

A single test file: `npx vitest run packages/<context>/<layer>/path/to/file.test.ts`; one
layer across every context: `npx vitest run --project domain`.

## Releasing

Bump `version` in `apps/desktop/package.json`, commit, then tag and push:

```sh
git tag v1.2.3 && git push origin v1.2.3
```

The `Release` workflow checks the tag matches that version, builds the Linux (`.deb`),
Windows (Squirrel `Setup.exe`) and macOS (`.dmg`, `.zip`) installers on their own
runners, uploads them to a draft GitHub release and publishes it once all three are in. To
build the installers without releasing, run the workflow by hand from the Actions tab; they
are kept as workflow artifacts.

The builds are not code-signed. Windows SmartScreen warns on first run ("More info" → "Run
anyway"). macOS refuses to open the app at first: try once, then allow it under System
Settings → Privacy & Security → "Open Anyway".

## Repo layout

```
apps/desktop             Electron app — main (the composition root), preload, and the React renderer
packages/<context>       One bounded context per package (currently: auth, schema, events), layered inside
packages/anytype-client  The shared Anytype local API HTTP client every context's adapters use
packages/kernel          Shared use-case plumbing (DispatchGuard) any context's application layer can import
tools/arch-lint          Isolated dependency-cruiser install (see its README for why)
docs/deps-notes.md       Why several dependencies are pinned where they are
```

### Architecture

Organised by bounded context first, then by hexagonal layer, then by role:

```
packages/auth/     signing in, and keeping the key
packages/schema/   the account's dated types, and which of them go on the calendar
packages/events/   the objects of those types in the month on screen
  domain/           model/, gateways/, repositories/  — the pure center
  application/      use cases, orchestrating the domain through its ports
  infrastructure/   driven adapters implementing those ports, by technology (in-memory/, anytype/, encrypted-file/, local-time/)
```

Each layer is imported from outside as `@anytype-calendar/<context>/<layer>`. Dependencies
point inward only, within a context:

```
domain          -> nothing
application     -> its own domain, plus kernel
infrastructure  -> its own domain, plus anytype-client
apps/desktop    -> any context's layers, plus Electron and React
```

A context's domain has no npm dependencies and no Node core imports, and the whole context
compiles with no ambient types (`types: []`), so platform globals like `process` or
`setTimeout` are out of reach too — infrastructure receives such capabilities from the
composition root instead. Adapters are reached through ports the domain declares, never
imported directly by the use cases. `packages/anytype-client` and `packages/kernel` are the
two shared packages — not contexts, each with only one layer, so the same aliasing, test
projects and lint rules apply to them unedited. `anytype-client` has only an
`infrastructure/` layer (the HTTP transport) and imports nothing else; `kernel` has only an
`application/` layer (the `DispatchGuard` dispatch/staleness-guard pattern used by use cases
that race an async gateway call against a later reset) and, uniquely, imports nothing at
all — not even Node core or npm — so it stays safely importable from any context's
application layer without adding a dependency edge of its own. Contexts never import each
other; `apps/desktop`'s main process wires them together. No package imports from
`apps/**`, and `electron`/`react` belong solely to `apps/desktop`.

All of that is enforced by `.dependency-cruiser.cjs` via `npm run lint:arch`, which reads
the rules alongside the reasoning for each one. Run it before opening a PR that adds
imports across package boundaries.

The workspace packages are consumed **from source** rather than from their built `dist/`,
through one pattern alias in `apps/desktop/electron.vite.config.ts` and the root `vitest.config.ts` —
so `npm run dev` and `npm test` never need a prior build, and editing a package hot-reloads
in the running app.

### The renderer

`apps/desktop/src/renderer/src` holds the React app: `App.tsx` is the root,
`screens/<flow>/` has one directory per screen (`auth`, `onboarding`, `config`, `month`),
`components/ui/` the presentational primitives, and `lib/` the pure modules that turn the
snapshots main pushes into what the screens draw (`lib/session.ts`, `lib/schema.ts`,
`lib/events.ts`). Nothing is mocked: every screen runs against the `auth`, `schema` and
`events` contexts' adapters over IPC. Navigation is local `useState`, not a router — four
fixed screens, no URLs — but the month on screen is held in main, and the arrows only ask
for another.

Imports that leave their own directory go through the `@renderer/*` alias
(`@renderer/components/ui`), and same-directory imports stay relative (`./EventChip`) — so
a module's own neighbourhood reads as local and everything else is absolute, with no `../../`
chains to recount when a file moves. The alias is declared in three places that must agree:
`resolve.alias` in `electron.vite.config.ts` (the bundler), `paths` in `tsconfig.web.json`
(the typechecker), and `paths` in the root `tsconfig.paths.json` (dependency-cruiser).
`@shared/*` works the same way for `src/shared/ipc.ts`, the IPC contract between main,
preload and renderer.

## Notes for contributors

- `docs/deps-notes.md` explains the version pins (`electron` exact, `vite@^7`,
  `@vitejs/plugin-react@^5.2.0`) and the `postinstall` steps. Read it before bumping any of
  those — several are load-bearing in non-obvious ways.
- `tools/arch-lint/README.md` explains why the lint toolchain lives outside the npm
  workspace, and how to remove it once dependency-cruiser supports TypeScript 7.
- Several files carry doc comments explaining *why* a structural choice was made
  (`App.tsx`, `lib/session.ts`, `types/index.ts`, `.dependency-cruiser.cjs`) — worth reading
  before changing their behavior.
- `AGENTS.md` is the guidance file for AI coding agents working in this repo.
