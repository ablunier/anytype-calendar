# Dependency notes

Conditions that currently block installing everything at `@latest`:

- `vite@latest` resolves to v8, but `electron-vite@latest` (5.0.0) only supports
  `vite@^5.0.0 || ^6.0.0 || ^7.0.0` as a peer — so vite must be pinned to `^7`.
- `@vitejs/plugin-react@latest` (6.x) requires `vite@^8.0.0` as a peer, which conflicts
  with the `vite@^7` pin above — so plugin-react must be pinned to `^5.2.0`, the last
  5.x line that supports vite 7 (`vite: '^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0'`).

- `electron` is an **exact** version. electron-builder, which packaged the app before
  Electron Forge, needed that: under npm workspaces Electron hoists to the repo root, and
  electron-builder could not resolve a range from `apps/desktop`. Forge reads the installed
  `node_modules/electron` next to the lockfile, so a range would now work too.

Pinned versions in use:

- `vite@^7.3.6`
- `@vitejs/plugin-react@^5.2.0`
- `electron@44.3.0` (exact)

Everything else (`@electron-forge/*`, `electron-vite`, `typescript`, `@types/*`)
installs fine at `@latest`.

## Electron Forge 7 on npm 12 and Node 26

Two of Forge 7.11's transitive dependencies are replaced through the root `overrides`:

- `@electron/rebuild` → `^4.2.0`. Forge asks for `^3.7.0`, and 3.x depends on
  `@electron/node-gyp` straight from a GitHub commit. npm 12 refuses git dependencies by
  default (`EALLOWGIT`), so the install fails outright. 4.x depends on `node-gyp` from the
  registry instead. It is ESM-only, which Forge's `require()` handles on Node ≥22.12.
- `yauzl` → `^3.4.0`. `@electron/packager` 18 unzips the Electron binary with
  `extract-zip` 2.0.1 (unmaintained since 2023), which asks for `yauzl@^2.10.0`. On that
  combination under Node 26 the extraction stops partway with nothing left to keep the
  event loop alive, so `electron-forge package` exits 0 during "Finalizing package" having
  written nothing. With `yauzl` 3 the same `extract-zip` unpacks the whole archive.
  `extract-zip` is its only consumer here.

  Swapping `extract-zip` itself for `@electron-internal/extract-zip` (what
  `@electron/packager` 20 uses) through an `npm:` alias override does not work on npm 12:
  it drops the dependency without installing the alias.

An override only applies when npm resolves the package afresh. A copy already recorded
in `package-lock.json` keeps its locked version, so after changing `overrides`, check the
lockfile actually moved.

Nothing here reaches the packaged app, which bundles its dependencies and ships no
`node_modules`. Re-check both when upgrading Forge: once it depends on
`@electron/packager` ≥20 and `@electron/rebuild` ≥4, the overrides can go.

Re-check these pins when bumping `electron-vite` or `@vitejs/plugin-react` — once
`electron-vite` adds vite 8 support, the plugin-react pin can likely move to `^6` too.

## Electron binary is not downloaded on plain `npm install`

Older Electron versions declared their own `postinstall` script (`node install.js`)
that downloaded the platform binary automatically during `npm install`. Electron 44
(the version pinned here) dropped that — its `package.json` has no `scripts` field
at all. Instead, `node_modules/electron/index.js` downloads the binary lazily, the
first time something does `require('electron')`.

That breaks `electron-vite`: it reads `node_modules/electron/path.txt` directly
(to resolve the binary path) instead of requiring the module, so the lazy download
never fires. Running `electron-vite dev` then fails with `Error: Electron uninstall`.

Fix: the root `postinstall` script explicitly runs Electron's installer:

```json
"postinstall": "node node_modules/electron/install.js && npm --prefix tools/arch-lint install"
```

Under npm workspaces Electron still hoists to the repo root, so
`node_modules/electron/install.js` resolves from the root unchanged. The
`tools/arch-lint` install is chained in because that directory is intentionally outside
the workspaces (see below).

Re-check this when bumping the `electron` major version — if a future release restores
the traditional postinstall-download behavior, this explicit step becomes redundant
(but harmless to leave in).

## dependency-cruiser cannot run on `typescript@7`

`npm run lint:arch` does **not** use the repo's own TypeScript. TypeScript 7 is the Go
rewrite and ships no JavaScript compiler API — against the installed copy:

```
$ node -e "const ts=require('typescript'); console.log(ts.createSourceFile, ts.sys)"
undefined undefined
```

Its `exports` map offers only `./unstable/*`. dependency-cruiser needs the classic API
(`createSourceFile`, `createProgram`) to parse `.ts`, and per its v18.1.0 release notes
`typescript@7.1.0` is the first v7 it will be able to support. The same wall currently
blocks typescript-eslint, `@angular/compiler-cli` and `@vue/compiler-sfc`.

The workaround is `tools/arch-lint/`: a self-contained install holding
`dependency-cruiser` plus `typescript@6.0.3` (the last JS-based line, full API), with
its own lockfile. It is deliberately **not** an npm workspace — npm would hoist
dependency-cruiser to the root `node_modules` and nest only `typescript@6`, and since
Node resolves a bare `require('typescript')` relative to the requiring module's own
directory, the hoisted dependency-cruiser would still find the root's v7.

See `tools/arch-lint/README.md` for how to collapse this back into the root once
TypeScript 7.1 ships a public API.

## The desktop app's package name is unscoped

`apps/desktop` is named `anytype-calendar-desktop`, not `@anytype-calendar/desktop`,
while the libraries under `packages/` do use the scope. Forge's makers derive names from
it: the Squirrel maker uses it, with `-` swapped for `_`, as the package id, and a scope's
`@` and `/` are not valid there, nor in deb package names. Nothing imports the
desktop app, so it gains nothing from the scope.

`forge.config.js` sets `executableName` and the deb `name` to `calendar-for-anytype`
explicitly, so the binary and Linux packages are named after the product rather than the
package. Squirrel's id is also written out in `squirrelAppUserModelId`
(`src/main/squirrel-startup.ts`): the running app must claim the AppUserModelID Squirrel
gives its shortcuts, so renaming the package means updating that constant.
