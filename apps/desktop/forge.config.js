const { resolve } = require('path')
const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')

const productName = 'Calendar for Anytype'
const executableName = 'calendar-for-anytype'

// electron-vite bundles every dependency into out/ (see electron.vite.config.ts), so the app
// needs nothing else but package.json and the Linux window icon under resources/.
const shipped = /^\/(package\.json$|out(\/|$)|resources(\/|$))/

const linuxOptions = {
  name: executableName,
  productName,
  // Defaults to package.json's name, which menus that show GenericName would display.
  genericName: 'Calendar for Anytype',
  bin: executableName,
  icon: resolve(__dirname, 'build/icons/512x512.png'),
  categories: ['Utility'],
  // The stock template has no StartupWMClass. GNOME on Wayland matches a window to its
  // .desktop entry by Electron's app id (package.json's desktopName, minus `.desktop`), and
  // the entry is named after the package instead, so without it the window gets a generic
  // taskbar icon.
  desktopTemplate: resolve(__dirname, 'build/linux/desktop.ejs')
}

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  // Forge's default, out/, is electron-vite's build output.
  outDir: 'dist',
  packagerConfig: {
    // Only the bundle and installers take the product name. package.json keeps its own, which
    // is what Electron names the userData directory after, so dev and packaged builds share it.
    name: productName,
    executableName,
    appBundleId: 'me.blunier.anytype.calendar',
    icon: resolve(__dirname, 'build/icon'),
    asar: true,
    ignore: (file) => file !== '' && !shipped.test(file),
    // Nothing from node_modules ships, and npm workspaces hoist it out of this directory anyway.
    prune: false
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: resolve(__dirname, 'build/icon.ico'),
        // Squirrel downloads this at install time for the Apps & features entry.
        iconUrl:
          'https://raw.githubusercontent.com/ablunier/anytype-calendar/main/apps/desktop/build/icon.ico'
      }
    },
    { name: '@electron-forge/maker-dmg', config: { icon: resolve(__dirname, 'build/icon.icns') } },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-deb', config: { options: linuxOptions } },
    { name: '@electron-forge/maker-rpm', config: { options: linuxOptions } }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'ablunier', name: 'anytype-calendar' },
        // The release workflow creates the draft before the per-OS jobs upload into it, and
        // publishes it once all of them have.
        draft: true
      }
    }
  ],
  plugins: [
    // Also re-applies the ad-hoc signature flipping invalidates, without which macOS on Apple
    // silicon refuses to open an app that has no real signature.
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
}
