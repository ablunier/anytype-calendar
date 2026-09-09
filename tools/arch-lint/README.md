# arch-lint

Isolated toolchain for `npm run lint:arch`. Holds `dependency-cruiser` plus
`typescript@6`, installed into its own `node_modules` with its own lockfile.

## Why this is not an npm workspace

The repo compiles with `typescript@7`, which ships no JavaScript compiler API —
`ts.createSourceFile`, `ts.createProgram` and `ts.sys` are all `undefined`, and the
package `exports` map offers only `./unstable/*`. dependency-cruiser needs the classic
API to parse `.ts` files; per its v18.1.0 release notes, `typescript@7.1.0` is the
first v7 it will be able to support.

Making this a workspace does not solve that. npm would hoist `dependency-cruiser` to
the root `node_modules` (nothing conflicts with it) and nest only `typescript@6` here.
Node resolves a bare `require('typescript')` relative to the requiring module's own
directory, so the hoisted dependency-cruiser would still find the root's v7 and refuse
to parse TypeScript.

Keeping this directory outside the `workspaces` globs puts both packages in the same
`node_modules`, so resolution lands on v6. Nothing else in the repo sees that version.

## Removing this once TypeScript 7.1 ships

When dependency-cruiser supports TS 7:

1. Move `dependency-cruiser` into the root `devDependencies`.
2. Change the root `lint:arch` script to run `depcruise` directly.
3. Delete this directory and drop the `tools/arch-lint` step from the root
   `postinstall`.

The ruleset itself lives at `.dependency-cruiser.cjs` in the repo root and does not
need to move.
