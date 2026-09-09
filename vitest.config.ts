import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const packageSrc = (name: string): string => resolve(__dirname, `packages/${name}/src`)

// Matches the aliases in apps/desktop/electron.vite.config.ts: tests run against package
// sources, so no build step is needed before `npm test`.
const workspaceAliases = {
  '@anytype-calendar/domain': packageSrc('domain'),
  '@anytype-calendar/application': packageSrc('application')
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: workspaceAliases },
        test: {
          name: 'domain',
          root: resolve(__dirname, 'packages/domain'),
          // No jsdom or happy-dom is installed anywhere in this repo, so the pure layers
          // cannot accidentally acquire a DOM.
          environment: 'node',
          include: ['src/**/*.test.ts']
        }
      },
      {
        resolve: { alias: workspaceAliases },
        test: {
          name: 'application',
          root: resolve(__dirname, 'packages/application'),
          environment: 'node',
          include: ['src/**/*.test.ts']
        }
      }
    ]
  }
})
