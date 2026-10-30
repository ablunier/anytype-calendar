# Releasing

Steps and what users see: `README.md` (Releasing). What the code does:

- Per-app desktop commands (run with `npm -w apps/desktop run <script>` from root, or `npm run <script>` from `apps/desktop/`): `typecheck:node`, `typecheck:web` (split because main/preload and renderer use different tsconfigs), and `package`/`make` (Electron Forge, configured in `apps/desktop/forge.config.js`; the root scripts of the same names run `tsc -b` first). Forge writes to `apps/desktop/dist`, since electron-vite owns `out/`, and builds for the host OS only: a `.deb` on Linux, a Squirrel `Setup.exe` on Windows, a `.dmg` and `.zip` on macOS. Nothing is code-signed yet.
- Releasing: bump `apps/desktop/package.json`'s `version`, then push a matching `v<version>` tag. `.github/workflows/release.yml` creates a draft release, runs `make` on Linux, Windows and macOS runners, uploads each one's installers into it with `gh release upload`, and publishes it once all three have uploaded. Forge's GitHub publisher is not used: its retried uploads failed as duplicates. Running the workflow by hand only makes the installers, as workflow artifacts. Installed
  Windows builds update themselves from those releases through update.electronjs.org
  (`src/main/updates/auto-update.ts`, `update-electron-app`); the repo must stay public.
  Squirrel.Mac applies nothing to an unsigned app and the `.deb` has no updater, so packaged
  macOS and Linux builds instead ask GitHub's `releases/latest` at launch and every 6 h, and
  show "Version X available" in the calendar's top bar (closable, remembered per version in
  the `dismissedUpdate` section of `app-config.json`) and in Settings → About, which also shows
  the running version; both open the release page. `releases/latest` skips prereleases, so a
  release marked as one is never offered. `ANYTYPE_CALENDAR_UPDATE_CHECK=1` runs that check in
  an unpackaged app, on any OS. Move macOS back to the updater once it is signed.
