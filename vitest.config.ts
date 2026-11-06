import { resolve } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

// Matches the alias in apps/desktop/electron.vite.config.ts: tests run against package
// sources, so no build step is needed before `npm test`.
const workspaceAlias = {
  find: /^@anytype-calendar\/([^/]+)\/(domain|application|infrastructure)$/,
  replacement: resolve(__dirname, 'packages/$1/$2/index.ts'),
}

// One project per layer kind across all contexts, so `--project domain` runs every
// context's domain tests at once.
const layerProject = (layer: 'domain' | 'application' | 'infrastructure') => ({
  resolve: { alias: [workspaceAlias] },
  test: {
    name: layer,
    root: __dirname,
    // Only the components project has a DOM, so the packages cannot accidentally acquire one.
    environment: 'node' as const,
    include: [`packages/*/${layer}/**/*.test.ts`],
  },
})

// Mirrors the aliases in apps/desktop/electron.vite.config.ts's `renderer` block, so these
// tests resolve the same modules the app does.
const rendererAlias = [
  { find: '@renderer', replacement: resolve(__dirname, 'apps/desktop/src/renderer/src') },
  { find: '@shared', replacement: resolve(__dirname, 'apps/desktop/src/shared') },
  workspaceAlias,
]

// Hooks render, so their tests need the DOM of the components project, though they hold no JSX.
const hookTests = 'apps/desktop/src/renderer/src/hooks/**/*.test.ts'

// The lib/ modules under test are pure functions with no DOM dependency, so `node` is enough.
const rendererProject = {
  resolve: { alias: rendererAlias },
  test: {
    name: 'renderer',
    root: __dirname,
    environment: 'node' as const,
    include: ['apps/desktop/src/renderer/src/**/*.test.ts'],
    // A hook test outside hooks/ lands here and fails for want of a DOM, not with a clear error.
    exclude: [...configDefaults.exclude, hookTests],
  },
}

// React components, driven by role and by real key and pointer sequences under jsdom, and hooks.
const componentsProject = {
  resolve: { alias: rendererAlias },
  test: {
    name: 'components',
    root: __dirname,
    environment: 'jsdom' as const,
    include: ['apps/desktop/src/renderer/src/**/*.test.tsx', hookTests],
    setupFiles: ['apps/desktop/src/renderer/src/test/setup.ts'],
  },
}

// The main process's pure glue — the modules under test import neither Electron nor Node
// core — with the aliases of electron.vite.config.ts's `main` block.
const mainProject = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(__dirname, 'apps/desktop/src/shared') }, workspaceAlias],
  },
  test: {
    name: 'main',
    root: __dirname,
    environment: 'node' as const,
    include: ['apps/desktop/src/main/**/*.test.ts'],
  },
}

// The agent skills' pure helpers, e.g. run-desktop's input events. Plain .mjs, no aliases.
const skillsProject = {
  test: {
    name: 'skills',
    root: __dirname,
    environment: 'node' as const,
    include: ['.agents/skills/**/*.test.mjs'],
  },
}

export default defineConfig({
  test: {
    // Contexts are scaffolded before they have tests; an empty project is not a failure.
    passWithNoTests: true,
    projects: [
      layerProject('domain'),
      layerProject('application'),
      layerProject('infrastructure'),
      rendererProject,
      componentsProject,
      mainProject,
      skillsProject,
    ],
  },
})
