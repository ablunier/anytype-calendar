/**
 * Enforces the hexagonal dependency rule.
 *
 *   domain        -> nothing (no npm deps, no node core, no other package)
 *   application   -> domain only
 *   anytype       -> domain only
 *   apps/desktop  -> all three, plus Electron and React
 *
 * Run via `npm run lint:arch`, which invokes dependency-cruiser from tools/arch-lint
 * against an isolated typescript@6 — see docs/deps-notes.md for why.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment:
        'packages/domain must not import anything outside itself. It is the centre of the ' +
        'hexagon: no other package, no app, no library.',
      severity: 'error',
      from: { path: '^packages/domain/src' },
      to: { pathNot: '^packages/domain/src' }
    },
    {
      name: 'domain-no-runtime-deps',
      comment:
        'packages/domain must not depend on npm packages or Node core modules. ' +
        'domain-is-pure also catches these; this rule exists for a clearer message.',
      severity: 'error',
      from: { path: '^packages/domain/src' },
      to: {
        // npm-no-pkg / npm-unknown matter here: a package resolved from the hoisted root
        // node_modules but absent from packages/domain/package.json lands in those
        // buckets, not in 'npm'.
        dependencyTypes: [
          'npm',
          'npm-dev',
          'npm-optional',
          'npm-peer',
          'npm-bundled',
          'npm-no-pkg',
          'npm-unknown',
          'core'
        ]
      }
    },
    {
      name: 'application-only-domain',
      comment:
        'packages/application is the use-case layer. It may import packages/domain and ' +
        'itself, nothing else. Adapters are injected through the domain ports.',
      severity: 'error',
      from: { path: '^packages/application/src' },
      to: { pathNot: '^(packages/application/src|packages/domain)' }
    },
    {
      name: 'anytype-only-domain',
      comment:
        'packages/anytype is a driven adapter. It may import packages/domain (to implement ' +
        'its ports) and itself, nothing else. Relax the pathNot here when it needs an HTTP ' +
        'client beyond global fetch.',
      severity: 'error',
      from: { path: '^packages/anytype/src' },
      to: { pathNot: '^(packages/anytype/src|packages/domain)' }
    },
    {
      name: 'packages-never-import-apps',
      comment:
        'Dependencies point inward. apps/desktop/src/main is the composition root and wires ' +
        'the packages together; no package may reach back out into it.',
      severity: 'error',
      from: { path: '^packages' },
      to: { path: '^apps' }
    },
    {
      name: 'no-electron-or-react-in-packages',
      comment:
        'No package may import Electron or React. Delivery mechanisms belong in apps/desktop.',
      severity: 'error',
      from: { path: '^packages' },
      to: { path: 'node_modules/(electron|react|react-dom)(/|$)' }
    },
    {
      name: 'no-circular',
      comment: 'Circular imports make the layering unenforceable and break incremental builds.',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'not-to-unresolvable',
      comment:
        'An unresolvable import means the lint is not actually seeing that dependency, ' +
        'so a boundary breach could slip past.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true }
    }
  ],
  options: {
    // node_modules is deliberately NOT in `exclude`. Excluding it drops npm packages out
    // of the graph altogether, which silently defeats domain-no-runtime-deps and
    // no-electron-or-react-in-packages. `doNotFollow` is what we want: npm packages stay
    // visible as leaf nodes so rules can match them, they just aren't traversed into.
    doNotFollow: { path: '(^|/)node_modules/' },
    exclude: {
      // Anchored to this repo's own build output. An unanchored (dist|out)/ also matches
      // node_modules/<pkg>/dist/..., which hides any npm package that ships from a dist
      // directory (vite, among many) and lets a boundary breach through unnoticed.
      path: '^(packages|apps)/[^/]+/(dist|out)/|\\.test\\.ts$|electron\\.vite\\.config\\.ts$'
    },
    // Resolution-only tsconfig mapping @anytype-calendar/* onto package sources, so the
    // lint runs without a prior `tsc -b`.
    tsConfig: { fileName: 'tsconfig.paths.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      // 'types' is required for type-only subpath exports such as vite/client, which
      // apps/desktop/src/renderer/src/env.d.ts references and which is published under
      // no other condition.
      conditionNames: ['types', 'import', 'require', 'node', 'default'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts', '.mjs', '.cjs']
    },
    reporterOptions: {
      text: { highlightFocused: true }
    }
  }
}
