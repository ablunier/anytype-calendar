# Architecture

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
with a user date property, their own or one their templates show in their content) and tracks
the last sync, which feeds the post-sign-in success
card and onboarding. Under v2 a sync also reads each space's image, whether each type has
Anytype's own Done and Location, its select properties' option colours, its queries over
a single dated type, with their views, and its collections, which a new object can be added
to. It also persists
the user's selection — which spaces, types and queries go on the calendar, each one's From/To
date property (a query's are its type's), whether those dates carry a time of day, which
select property, if any, colours its objects (`colourBy`), which checkbox ticks it done and
which text places it (`done`, `location`: Anytype's own until picked), which further properties
its detail panel shows, in order (`panel`), and a query's view — which onboarding and Settings
save.
`events` reads, for the span on screen — a month, a week or a day — the objects of the
selected types and queries whose dates fall in it, with their Done, Location, colour-by option
and panel properties where v2 serves them (linked objects named in the same load, one search
per space), which the calendar screen draws as a month grid or as an hour grid. An object a
type and a query both bring is read once through each and kept for each, with its source's
`rank`; the renderer draws it once, as its lowest-ranked visible source places it. Where the
key reads through v2 and may write, the calendar also edits: an object is moved by dragging
it, created by double-clicking a day or an hour (and, if a collection is picked, added to
it), and ticked done, given exact dates and times, or given or cleared a To date from its
panel. `feeds` holds external
calendars subscribed to by their iCalendar address (Settings → Subscribed calendars): it reads
each with ical.js, keeps it in memory and expands it over the span on screen, and the renderer
draws its events read-only beside Anytype's objects. No screen runs on mock data.

## Layout: bounded context → layer → role

Each package under `packages/` is one bounded context (currently `auth`, `schema`, `events` and `feeds`), and its
layers are folders inside it — except `anytype-v1` and `kernel` (see below):

```
packages/<context>/
  package.json        @anytype-calendar/<context>, exports ./domain ./application ./infrastructure
  tsconfig.json       ONE tsconfig project for the whole context, `types: []`
  domain/             grouped by role: model/, gateways/, repositories/ (services/ when needed)
  application/        use cases, flat
  infrastructure/     driven adapters, grouped by technology: in-memory/, anytype/, encrypted-file/, local-time/, ical/, http/, file/
  dist/<layer>/       tsc -b output (gitignored)
```

Anytype is reached through `@ablunier/anytype-client`, a typed client for its local API v2
published from its own repo (`github.com/ablunier/anytype-client`, `../anytype-client` beside
this one; its `README.md` has its surface and the API's quirks). A route it lacks, or a fix,
goes there and is released as a new version, not patched here. Adapters call one method per route
(`client.withApiKey(key).types.get(…)`) and never build a path; `listAll` pages a list. Error
statuses resolve as values (`{ ok: false, status, error, unsupported }`), and only transport
failure rejects (`AnytypeTransportError`). The composition root injects `fetch`, with a
timeout. Writes carry an `Idempotency-Key` and are retried once when they got no answer.

`packages/anytype-v1` and `packages/kernel` are not contexts but shared packages, each
with only one layer, so the pattern-based aliases, vitest projects and lint rules apply to
them unedited. `anytype-v1` holds what the app still needs of v1, which the client does not
serve: `AnytypeV1Client` (the few v1 routes read, through the same `AnytypeClient`, with v1's
`Anytype-Version` header; `listAllV1` pages them) and `AnytypeDialectProbe`, which asks
Anytype once per key which major of the API it serves (`whoami`: an answer means v2, an
`unsupported` one — a bare plain-text 404 — means a build without v2). Each context's
`infrastructure/anytype/` has an `AnytypeV1*Gateway`, an `AnytypeV2*Gateway` and an
`Anytype*Gateway` that picks one of the two per call through the probe, so dropping v1 later
means deleting `anytype-v1` and one file per context. The client's `onUnsupported` calls
`probe.forgetV2()`, so any v2 route meeting the bare 404 drops a v2 answer, and leaving the
`connected` session calls `probe.forget()`. `kernel` holds `DispatchGuard`, the store-plus-reducer dispatch/
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
  pattern-based and need no edits. A context whose adapters talk to Anytype also lists
  `@ablunier/anytype-client` and `@anytype-calendar/anytype-v1` as dependencies and
  references `../anytype-v1` from its tsconfig, as `auth` does;
  likewise for `kernel` in a context's `application` layer (`auth`, `schema` and
  `events` all do). Either way, run `npm install` afterward so npm workspaces symlinks the new package
  into `node_modules` — without it, `tsc -b` fails with `TS2307: Cannot find module`.

## Hexagonal layering (enforced by `.dependency-cruiser.cjs`, run via `npm run lint:arch`)

```
packages/<ctx>/domain          -> nothing outside itself (no npm deps, no Node core)
packages/<ctx>/application     -> its own context's domain, plus kernel (use cases / orchestration)
packages/<ctx>/infrastructure  -> its own context's domain, plus anytype-client and anytype-v1 (driven adapters implementing domain ports)
packages/feeds/infrastructure  -> its own domain, plus ical.js (feeds talks to no Anytype)
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
  reach into its own `domain`, `packages/anytype-v1/infrastructure` and the Anytype client
  (`node_modules/@ablunier/anytype-client`). The same rule keeps `anytype-v1` itself a leaf that imports no context.
  `feeds` is the exception, by a rule of its own: its infrastructure may import its own domain
  and `ical.js`, nothing else, and ical.js stays behind the domain port `FeedsCalendarParser`.
- Contexts never import each other; the composition root in `apps/desktop/src/main` wires
  them together. The rules capture the context name and refer back to it (`$1`), so this
  holds for every context without a rule per package.
- No package may import from `apps/**` (dependencies point inward only) or from
  `electron`/`react`/`react-dom` (delivery mechanisms belong solely in `apps/desktop`).

## Wiring by hand: no DI container

The composition root builds every object itself with `new` and passes each one its
dependencies object. This is deliberate. Don't add a dependency injection library:
- Decorator containers (tsyringe, InversifyJS) need `@injectable()` on classes in
  `packages/`, which is an npm dependency the layering rules forbid. They also need
  `emitDecoratorMetadata`, which esbuild (and so electron-vite) doesn't emit.
- Containers that wire by name (awilix) can't tell dependencies apart, because the ports
  use generic names: `gateway` and `store` mean something different in each use case. Every
  registration would need a manual override, which is the same wiring with a detour.
  Renaming the ports to suit a container would leak it into the packages.
- Hand wiring is typechecked: a missing or wrong dependency fails `tsc`, not a launch.
- Everything is a singleton, so there are no scopes for a container to manage. The hard
  parts aren't the `new` calls. They are the choice of adapters (fake mode, API major, OS
  encryption) and the subscriptions that link the contexts, and those stay code either way.

Keep it readable by splitting it into modules, not by adding a container.

Contexts are consumed **from source**, not from their built `dist/`, via one pattern alias
(`@anytype-calendar/<ctx>/<layer>` → `packages/<ctx>/<layer>/index.ts`) in both
`apps/desktop/electron.vite.config.ts` and root `vitest.config.ts` — so `npm run dev` and
`npm test` never require a prior `tsc -b`, and editing a package gets HMR in the running
app. `tsc -b` project references are what actually typechecks the packages (apps resolve
the entry points through each package's `exports` to its emitted declarations);
`tsconfig.paths.json` is a separate resolution-only config consumed by dependency-cruiser
so `lint:arch` doesn't need a build either.
