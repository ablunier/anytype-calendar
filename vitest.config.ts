import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Matches the alias in apps/desktop/electron.vite.config.ts: tests run against package
// sources, so no build step is needed before `npm test`. Within a context, layers import
// each other relatively; this covers any test that goes through a context's entry point.
const workspaceAlias = {
  find: /^@anytype-calendar\/([^/]+)\/(domain|application|infrastructure)$/,
  replacement: resolve(__dirname, 'packages/$1/$2/index.ts')
}

// One project per layer kind, each spanning every bounded context, so `--project domain`
// runs the pure layer of all contexts at once and a new context needs no change here.
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

export default defineConfig({
  test: {
    // Contexts are scaffolded before they have tests; an empty project is not a failure.
    passWithNoTests: true,
    projects: [layerProject('domain'), layerProject('application'), layerProject('infrastructure')]
  }
})
