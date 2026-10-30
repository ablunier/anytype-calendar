# Agent Instructions

Electron + React desktop calendar over the Anytype local API. npm workspaces monorepo:
`apps/desktop`, plus one bounded context per package in `packages/` (`auth`, `schema`,
`events`, `feeds`) and the shared `kernel`.

## Package Manager

- Use **npm**: `npm install`. Its `postinstall` also fetches the Electron binary and installs `tools/arch-lint`.

## Commands

Run from the repo root. CI runs typecheck, tests and `lint:arch`.

| Task                  | Command                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| Test file             | `npx vitest run packages/<context>/<layer>/path/to/file.test.ts`       |
| Test one layer        | `npx vitest run --project domain`                                      |
| Test everything       | `npm test`                                                             |
| Typecheck everything  | `npm run typecheck`                                                    |
| Typecheck the app     | `npm -w apps/desktop run typecheck:web` (or `typecheck:node`)          |
| Layering rules        | `npm run lint:arch`                                                    |
| Run the app           | `env -u ELECTRON_RUN_AS_NODE npm run dev`                              |
| Run with fake Anytype | `env -u ELECTRON_RUN_AS_NODE ANYTYPE_CALENDAR_FAKE_AUTH=1 npm run dev` |

- Without `env -u ELECTRON_RUN_AS_NODE`, Electron fails with a misleading `isPackaged` TypeError.
- Fake sign-in: code `2749`, or the API key `ak_fake_2749`.
- Vitest projects: `domain`, `application`, `infrastructure`, `renderer` (pure `lib/` modules), `main` (pure glue: no Electron or Node core imports).

## External References

| Need                                                 | File                          |
| ---------------------------------------------------- | ----------------------------- |
| Contexts, layers, import rules, adding a context     | `docs/architecture.md`        |
| Main process, IPC, renderer, screens, `lib/` modules | `docs/desktop-app.md`         |
| Anytype API v2 behaviour the adapters rely on        | `docs/anytype-api.md`         |
| Release workflow and update checks                   | `docs/releasing.md`           |
| Version pins, `postinstall`, packaging               | `docs/deps-notes.md`          |
| Layering rules and their reasons                     | `.dependency-cruiser.cjs`     |
| Why `tools/arch-lint` is outside the workspace       | `tools/arch-lint/README.md`   |
| Client surface and API quirks                        | `../anytype-client/README.md` |

## Key Conventions

- Contexts never import each other; `apps/desktop/src/main/composition.ts` wires them, through one `compose-*.ts` module per context and `context-links.ts`.
- From outside a context, import only `@anytype-calendar/<context>/<layer>`.
- `domain` imports nothing; `application` imports its domain and `kernel`; `infrastructure` imports its domain and `@ablunier/anytype-client`.
- `feeds/infrastructure` imports only its domain and `ical.js`.
- `types: []` covers each context: inject platform capabilities (`fetch`, timers, `console`) from the composition root.
- Add modules under their role or technology folder and re-export them from the layer's `index.ts`.
- Exported names carry their context: `AuthSession`, not `Session`.
- Do not add a DI container; wiring is by hand.
- Reach Anytype only through `@ablunier/anytype-client`; a missing route or a fix goes in `../anytype-client` and is released, not patched here.
- Each context's `infrastructure/anytype/` keeps one gateway, which reads the client's `unsupported` (an Anytype without v2) as `outdated` and never signs out for it.
- In the renderer, import outside the file's directory through `@renderer/*`, never `../..`; same-directory imports stay relative.
- A new alias must be declared in `electron.vite.config.ts`, `tsconfig.web.json` or `tsconfig.node.json`, and `tsconfig.paths.json`.
- Only `lib/session.ts`, `lib/schema.ts` and `lib/events.ts` read IPC snapshot shapes; components get view-model types.
- User-facing copy goes in every locale under `apps/desktop/src/renderer/src/i18n/locales/`; pure `lib/` modules stay translation-free.
- Comments say only what code cannot: why, a constraint, a unit, an external fact. If one must say what something is, rename it instead. This covers JSDoc on exports too.
- Layer `index.ts` barrels keep their one-line comment stating what the layer may depend on.
- Read `docs/deps-notes.md` before bumping `vite`, `@vitejs/plugin-react` or `electron`.
- Do not fold `tools/arch-lint` into the root `devDependencies`.
- When a change alters behaviour a doc above describes, update that doc in the same change.
