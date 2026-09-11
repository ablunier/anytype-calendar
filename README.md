# Calendar for Anytype

A desktop calendar for [Anytype](https://anytype.io). It reads objects from your local
Anytype account through the local API and lays the ones carrying date properties onto a
month grid — so a `Task` with a due date, a `Meeting` with a start and end, and a `Note`
with a creation date all show up in one place, without leaving your data or moving it
anywhere.

You pick which spaces and object types to track, and which date property of each type
anchors it on the grid (a type with both a start and an end property is drawn as a range).

> **Status: early.** The desktop UI is fully built and navigable, but it runs entirely on
> mock data. The backend is organised as one package per bounded context — `auth` is the
> first, scaffolded with its layering rules in place and still empty. Nothing talks to
> Anytype yet.

## Requirements

- Node.js ≥ 26.8.1 and npm ≥ 12.0.2 (both pinned via [Volta](https://volta.sh) in
  `package.json`; Volta will pick them up automatically if installed)
- Anytype desktop, for anything beyond the mock UI — once the adapter lands

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

Since the app has no backend yet, it opens on the auth screen with the flow going nowhere
real. Use the **flow switcher** in the bottom corner — a dev-only harness — to jump
straight to any of the ten design frames, including the states the product can only reach
through a backend (a failed code exchange, a pre-opened detail panel).

## Scripts

Run from the repo root.

| Command | What it does |
| --- | --- |
| `npm run dev` | electron-vite dev server + Electron, with HMR (see the env note above) |
| `npm run build` | `tsc -b` across all packages, then build the desktop app |
| `npm run typecheck` | `tsc -b --force` over the whole monorepo |
| `npm test` | `vitest run`, one project per layer (`domain`, `application`, `infrastructure`) across all contexts |
| `npm run lint:arch` | dependency-cruiser check of the hexagonal layering |
| `npm run lint:arch:setup` | install the arch-lint toolchain (only if `postinstall` was skipped) |
| `npm run clean` | `tsc -b --clean` plus the desktop app's `out/` and `dist/` |
| `npm run build:linux` / `:mac` / `:win` / `:unpack` | package with electron-builder |

A single test file: `npx vitest run packages/<context>/<layer>/path/to/file.test.ts`; one
layer across every context: `npx vitest run --project domain`.

## Repo layout

```
apps/desktop        Electron app — main (the composition root), preload, and the React renderer
packages/<context>  One bounded context per package (currently: auth), layered inside
tools/arch-lint     Isolated dependency-cruiser install (see its README for why)
docs/deps-notes.md  Why several dependencies are pinned where they are
```

### Architecture

Organised by bounded context first, then by hexagonal layer, then by role:

```
packages/auth/
  domain/           model/, gateways/, repositories/  — the pure center
  application/      use cases, orchestrating the domain through its ports
  infrastructure/   driven adapters implementing those ports, by technology (in-memory/, anytype/)
```

Each layer is imported from outside as `@anytype-calendar/<context>/<layer>`. Dependencies
point inward only, within a context:

```
domain          -> nothing
application     -> its own domain
infrastructure  -> its own domain
apps/desktop    -> any context's layers, plus Electron and React
```

A context's domain has no npm dependencies and no Node core imports, and the whole context
compiles with no ambient types (`types: []`), so platform globals like `process` or
`setTimeout` are out of reach too — infrastructure receives such capabilities from the
composition root instead. Adapters are reached through ports the domain declares, never
imported directly by the use cases. Contexts never import each other; `apps/desktop`'s main
process wires them together. No package imports from `apps/**`, and `electron`/`react`
belong solely to `apps/desktop`.

All of that is enforced by `.dependency-cruiser.cjs` via `npm run lint:arch`, which reads
the rules alongside the reasoning for each one. Run it before opening a PR that adds
imports across package boundaries.

The workspace packages are consumed **from source** rather than from their built `dist/`,
through one pattern alias in `apps/desktop/electron.vite.config.ts` and the root `vitest.config.ts` —
so `npm run dev` and `npm test` never need a prior build, and editing a package hot-reloads
in the running app.

### The renderer

`apps/desktop/src/renderer/src` holds the React app: `App.tsx` is the root and the only
module that reads the mock data, `screens/<flow>/` has one directory per screen (`auth`,
`onboarding`, `config`, `month`), `components/ui/` the presentational primitives, and
`mocks/index.ts` the sample data that stands in for the eventual IPC-backed layer.
Navigation is local `useState`, not a router — four fixed screens, no URLs.

Imports that leave their own directory go through the `@renderer/*` alias
(`@renderer/components/ui`), and same-directory imports stay relative (`./EventChip`) — so
a module's own neighbourhood reads as local and everything else is absolute, with no `../../`
chains to recount when a file moves. The alias is declared in three places that must agree:
`resolve.alias` in `electron.vite.config.ts` (the bundler), `paths` in `tsconfig.web.json`
(the typechecker), and `paths` in the root `tsconfig.paths.json` (dependency-cruiser).

## Notes for contributors

- `docs/deps-notes.md` explains the version pins (`electron` exact, `vite@^7`,
  `@vitejs/plugin-react@^5.2.0`) and the `postinstall` steps. Read it before bumping any of
  those — several are load-bearing in non-obvious ways.
- `tools/arch-lint/README.md` explains why the lint toolchain lives outside the npm
  workspace, and how to remove it once dependency-cruiser supports TypeScript 7.
- Several files carry doc comments explaining *why* a structural choice was made
  (`App.tsx`, `lib/frames.ts`, `types/index.ts`, `.dependency-cruiser.cjs`) — worth reading
  before changing their behavior.
- `AGENTS.md` is the guidance file for AI coding agents working in this repo.
