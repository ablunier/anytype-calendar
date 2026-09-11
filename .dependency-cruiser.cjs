/**
 * Contexts never import each other — the composition root in apps/desktop/src/main wires
 * them together. That follows from the three layer rules rather than needing its own.
 *
 * The rules capture the context name in `from.path` and refer back to it as `$1` in
 * `to.pathNot`, so each rule holds for every context, present and future, unedited.
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
        "A context's domain must not import anything outside itself. It is the centre of " +
        'the hexagon: no other layer, no other context, no app, no library.',
      severity: 'error',
      from: { path: '^packages/([^/]+)/domain/' },
      to: { pathNot: '^packages/$1/domain/' }
    },
    {
      name: 'domain-no-runtime-deps',
      comment:
        "A context's domain must not depend on npm packages or Node core modules. " +
        'domain-is-pure also catches these; this rule exists for a clearer message.',
      severity: 'error',
      from: { path: '^packages/[^/]+/domain/' },
      to: {
        // npm-no-pkg / npm-unknown matter here: a package resolved from the hoisted root
        // node_modules but absent from the context's package.json lands in those
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
      name: 'application-only-own-domain',
      comment:
        "A context's application layer holds its use cases. It may import itself, its own " +
        "context's domain, and the shared dispatch-guard kernel; nothing else. Adapters " +
        'are injected through the domain ports. kernel is not a context: it has only an ' +
        'application layer, so this same rule keeps it a leaf that imports no context.',
      severity: 'error',
      from: { path: '^packages/([^/]+)/application/' },
      to: { pathNot: '^packages/(?:$1/(?:application|domain)|kernel/application)/' }
    },
    {
      name: 'kernel-is-pure',
      comment:
        'The shared kernel must not import anything beyond itself — no context, no npm ' +
        "package, no Node core module. It exists to be safely importable from every " +
        "context's application layer without pulling in a dependency edge of its own.",
      severity: 'error',
      from: { path: '^packages/kernel/application/' },
      to: { pathNot: '^packages/kernel/application/' }
    },
    {
      name: 'infrastructure-only-own-domain',
      comment:
        "A context's infrastructure layer holds its driven adapters. It may import itself " +
        "and its own context's domain (to implement its ports), plus the shared Anytype " +
        'HTTP client, nothing else. anytype-client is not a context: it has only an ' +
        'infrastructure layer, so this same rule keeps it a leaf that imports no context.',
      severity: 'error',
      from: { path: '^packages/([^/]+)/infrastructure/' },
      to: { pathNot: '^packages/(?:$1/(?:infrastructure|domain)|anytype-client/infrastructure)/' }
    },
    {
      name: 'packages-never-import-apps',
      comment:
        'Dependencies point inward. apps/desktop/src/main is the composition root and wires ' +
        'the contexts together; no package may reach back out into it.',
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
