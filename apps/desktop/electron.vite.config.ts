import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The workspace packages are consumed from source rather than from their dist/ output,
// so `dev` and `build` never require a prior `tsc -b` and edits inside packages/ trigger
// HMR. `tsc -b` still typechecks them through project references.
const workspaceAlias = {
  find: /^@anytype-calendar\/([^/]+)\/(domain|application|infrastructure)$/,
  replacement: resolve(__dirname, '../../packages/$1/$2/index.ts')
}

// The IPC contract, imported by all three processes.
const sharedAlias = { find: '@shared', replacement: resolve(__dirname, 'src/shared') }

// Main and preload bundle every dependency, leaving only `electron` and Node core as
// `require`s. The packaged app therefore ships no node_modules (see forge.config.js), which
// Forge could not assemble anyway: npm workspaces hoist them to the repo root.
const bundleDeps = { externalizeDeps: false }

export default defineConfig({
  main: {
    resolve: {
      alias: [sharedAlias, workspaceAlias]
    },
    build: bundleDeps
  },
  preload: {
    resolve: {
      alias: [sharedAlias, workspaceAlias]
    },
    build: bundleDeps
  },
  renderer: {
    resolve: {
      alias: [
        { find: '@renderer', replacement: resolve(__dirname, 'src/renderer/src') },
        sharedAlias,
        workspaceAlias
      ]
    },
    build: {
      // Vite inlines assets under 4 KB as data: URIs. Every icon is ~300 bytes, so all of them
      // would be inlined — and the renderer's CSP has no img-src, meaning images fall back
      // to default-src 'self', which does not cover data:. Icon is a mask-image, an area
      // where CSP enforcement differs between engines, so rather than depend on that gap
      // (or widen the policy) the SVGs are emitted as ordinary same-origin files.
      assetsInlineLimit: (filePath) => (filePath.endsWith('.svg') ? false : undefined)
    },
    plugins: [react(), tailwindcss()]
  }
})
