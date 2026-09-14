import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Matches the alias in apps/desktop/electron.vite.config.ts: tests run against package
// sources, so no build step is needed before `npm test`.
const workspaceAlias = {
  find: /^@anytype-calendar\/([^/]+)\/(domain|application|infrastructure)$/,
  replacement: resolve(__dirname, 'packages/$1/$2/index.ts')
}

// One project per layer kind across all contexts, so `--project domain` runs every
// context's domain tests at once.
const layerProject = (layer: 'domain' | 'application' | 'infrastructure') => ({
  resolve: { alias: [workspaceAlias] },
  test: {
    name: layer,
    root: __dirname,
    // No jsdom or happy-dom is installed anywhere in this repo, so the packages cannot
    // accidentally acquire a DOM.
    environment: 'node' as const,
    include: [`packages/*/${layer}/**/*.test.ts`]
  }
})

// Mirrors the aliases in apps/desktop/electron.vite.config.ts's `renderer` block, so these
// tests resolve the same modules the app does. The lib/ modules under test are pure
// functions with no DOM dependency, so `node` is enough — no jsdom/happy-dom is installed.
const rendererProject = {
  resolve: {
    alias: [
      { find: '@renderer', replacement: resolve(__dirname, 'apps/desktop/src/renderer/src') },
      { find: '@shared', replacement: resolve(__dirname, 'apps/desktop/src/shared') },
      workspaceAlias
    ]
  },
  test: {
    name: 'renderer',
    root: __dirname,
    environment: 'node' as const,
    include: ['apps/desktop/src/renderer/src/**/*.test.ts']
  }
}

// The main process's pure glue — the modules under test import neither Electron nor Node
// core — with the aliases of electron.vite.config.ts's `main` block.
const mainProject = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(__dirname, 'apps/desktop/src/shared') }, workspaceAlias]
  },
  test: {
    name: 'main',
    root: __dirname,
    environment: 'node' as const,
    include: ['apps/desktop/src/main/**/*.test.ts']
  }
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
      mainProject
    ]
  }
})
