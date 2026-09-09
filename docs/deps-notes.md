# Dependency notes

Conditions that currently block installing everything at `@latest`:

- `vite@latest` resolves to v8, but `electron-vite@latest` (5.0.0) only supports
  `vite@^5.0.0 || ^6.0.0 || ^7.0.0` as a peer — so vite must be pinned to `^7`.
- `@vitejs/plugin-react@latest` (6.x) requires `vite@^8.0.0` as a peer, which conflicts
  with the `vite@^7` pin above — so plugin-react must be pinned to `^5.2.0`, the last
  5.x line that supports vite 7 (`vite: '^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0'`).

Pinned versions in use:

- `vite@^7.3.6`
- `@vitejs/plugin-react@^5.2.0`

Everything else (`electron`, `electron-builder`, `electron-vite`, `typescript`,
`@types/*`) installs fine at `@latest`.

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
"postinstall": "node node_modules/electron/install.js && electron-builder install-app-deps"
```

Re-check this when bumping the `electron` major version — if a future release restores
the traditional postinstall-download behavior, this explicit step becomes redundant
(but harmless to leave in).
