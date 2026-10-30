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
- `electron@44.9.3` (exact)

Everything else (`@electron-forge/*`, `electron-vite`, `typescript`, `@types/*`)
installs fine at `@latest`.

## Electron Forge 8

Forge 7.11 needed two root `overrides` on npm 12 and Node 26: `@electron/rebuild` ^4 (3.x
pulls `@electron/node-gyp` from git, which npm 12 refuses) and `yauzl` ^3.4 (under the 2.x
that `@electron/packager` 18's `extract-zip` asked for, `package` exited 0 having written
nothing). Forge 8 depends on `@electron/rebuild` ^4.2 and `@electron/packager` ^20, which
no longer uses `extract-zip`, so both overrides are gone.

Forge 8 is ESM-only. `forge.config.js` stays CommonJS: Node's `require(esm)` loads
`@electron-forge/plugin-fuses` and `@electron/fuses` 2.x, whose API is unchanged. `make`
now also saves its results to `dist/make-results/`, beside `dist/make/`, so the release
workflow's upload of `dist/make` picks up only installers.

`npm audit` still reports `image-size` (GHSA-w3rx-r6r6-pgpr, an infinite loop on a crafted
ICNS) through `maker-dmg` → `electron-installer-dmg` → `appdmg`. `appdmg` asks for
`image-size@^0.7.4` and the fix is 2.0.3, whose API differs, so an override would break the
DMG build. It is installed only on macOS, runs only at build time, and reads only our own
icon. Nothing here reaches the packaged app, which bundles its dependencies and ships no
`node_modules`.

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

## The packaged app ships no `node_modules`

Main and preload bundle every dependency (`externalizeDeps: false` in
`electron.vite.config.ts`), and `forge.config.js` packages only `out/`, `resources/` and
`package.json`. npm workspaces hoist `node_modules` out of `apps/desktop`, so Forge could
not assemble them anyway. A dependency that cannot be bundled (a native module) would
need that revisited.
