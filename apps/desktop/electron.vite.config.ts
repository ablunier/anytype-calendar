import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// The workspace packages are consumed from source rather than from their dist/ output,
// so `dev` and `build` never require a prior `tsc -b` and edits inside packages/ trigger
// HMR. `tsc -b` still typechecks them through project references.
const packageSrc = (name: string): string => resolve(__dirname, `../../packages/${name}/src`)

const workspaceAliases = {
  '@anytype-calendar/domain': packageSrc('domain'),
  '@anytype-calendar/application': packageSrc('application'),
  '@anytype-calendar/anytype': packageSrc('anytype')
}

// They are listed in apps/desktop dependencies, so externalizeDepsPlugin would otherwise
// leave them as bare `require`s that the packaged app cannot resolve. Bundle them instead.
const workspaceDeps = Object.keys(workspaceAliases)

export default defineConfig({
  main: {
    resolve: {
      alias: workspaceAliases
    },
    plugins: [externalizeDepsPlugin({ exclude: workspaceDeps })]
  },
  preload: {
    resolve: {
      alias: workspaceAliases
    },
    plugins: [externalizeDepsPlugin({ exclude: workspaceDeps })]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        ...workspaceAliases
      }
    },
    plugins: [react()]
  }
})
