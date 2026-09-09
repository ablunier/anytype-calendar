# Dependency notes

Conditions that currently block installing everything at `@latest`:

- `vite@latest` resolves to v8, but `electron-vite@latest` (5.0.0) only supports
  `vite@^5.0.0 || ^6.0.0 || ^7.0.0` as a peer — so vite must be pinned to `^7`.
- `@vitejs/plugin-react@latest` (6.x) requires `vite@^8.0.0` as a peer, which conflicts
  with the `vite@^7` pin above — so plugin-react must be pinned to `^5.2.0`, the last
  5.x line that supports vite 7 (`vite: '^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0'`).

- `electron` must be an **exact** version, not a range. electron-builder computes the
  Electron version by looking for `node_modules/electron` in the project directory, and
  under npm workspaces Electron hoists to the repo root, so `apps/desktop/node_modules`
  does not exist. With a range it fails outright:

  > Electron version "^44.3.0" is a range, not a fixed version. […] Cannot compute
  > electron version from installed node modules

  An exact version lets electron-builder read it straight from `package.json` without
  resolving the module, which keeps a single source of truth. Setting `electronVersion`
  in `electron-builder.yml` would also work but duplicates the number.

Pinned versions in use:

- `vite@^7.3.6`
- `@vitejs/plugin-react@^5.2.0`
- `electron@44.3.0` (exact)

Everything else (`electron-builder`, `electron-vite`, `typescript`, `@types/*`)
installs fine at `@latest`.

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

`electron-builder install-app-deps` does **not** fix this either — it only rebuilds
native modules against the Electron ABI, it doesn't fetch Electron's own binary.

Fix: the root `postinstall` script explicitly runs Electron's installer before
`electron-builder install-app-deps`:

```json
"postinstall": "node node_modules/electron/install.js && npm --prefix tools/arch-lint install && npm -w apps/desktop exec -- electron-builder install-app-deps"
```

Under npm workspaces Electron still hoists to the repo root, so
`node_modules/electron/install.js` resolves from the root unchanged.
`install-app-deps` is scoped to `apps/desktop` because that is where
`electron-builder.yml` lives, and the `tools/arch-lint` install is chained in because
that directory is intentionally outside the workspaces (see below).

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
while the three libraries under `packages/` do use the scope. electron-builder feeds
the package name into `${name}` for artifact filenames and into the Linux executable
name, and a scoped name produces artifacts like `@anytype-calendardesktop`. Nothing
imports the desktop app, so it gains nothing from the scope.

`linux.executableName` is also set explicitly in `electron-builder.yml`, mirroring the
`win.executableName` that was already there, so the binary is named after the product
rather than the package either way.
