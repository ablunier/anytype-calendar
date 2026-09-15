#!/usr/bin/env bash
# Packages the Windows target inside electronuserland/builder:wine, since electron-builder
# shells out to Wine (rcedit/signtool) to build the NSIS installer and this machine has no
# native Wine install. Assumes `npm run build` has already produced apps/desktop/out.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

WINE_HOME="dist/.wine-home"
mkdir -p "$WINE_HOME"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/home/builder \
  -v "$(pwd)/../..":/project \
  -v "$(pwd)/$WINE_HOME":/home/builder \
  -v "$HOME/.cache/electron":/home/builder/.cache/electron \
  -v "$HOME/.cache/electron-builder":/home/builder/.cache/electron-builder \
  -w /project/apps/desktop \
  electronuserland/builder:wine \
  bash -lc "../../node_modules/.bin/electron-builder --win"
