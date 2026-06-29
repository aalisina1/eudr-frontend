#!/usr/bin/env bash
# Recreate the synth-entry scratch "package root" the design-sync build needs.
#
# This repo is a Next.js app, not a published component package, so the converter
# has no node_modules/<pkg> and no dist/.d.ts. We give it a minimal PKG_DIR that
# (a) carries a src/ tree to synthesize the entry from, and (b) does NOT contain a
# looping node_modules (a self-symlink recurses infinitely in ts-morph).
#
# Run from the app root before package-build / resync. Idempotent.
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
PKGROOT="$APP/.design-sync/.cache/pkgroot"

rm -rf "$PKGROOT"
mkdir -p "$PKGROOT"
printf '{"name":"eudr-frontend","version":"0.1.0"}\n' > "$PKGROOT/package.json"
ln -sfn "$APP/src" "$PKGROOT/src"
ln -sfn "$APP/tsconfig.json" "$PKGROOT/tsconfig.json"

# Tailwind v4: ship the COMPILED stylesheet (generated utilities + :root tokens),
# not the source globals.css (which is just @import "tailwindcss"). cssEntry is
# bounded to PKG_DIR's realpath, so we compile a REAL file into pkgroot (a symlink
# to .next/ would realpath outside the bound and get skipped). We do NOT reuse the
# app's .next chunk — it only contains classes the app used, leaving the design
# agent's own layout glue unstyled. Instead compile .design-sync/tailwind-full.css
# (imports the real globals.css for tokens + component scan, plus a broad
# @source inline utility safelist) into a COMPLETE utility sheet.
npx --yes @tailwindcss/cli -i "$APP/.design-sync/tailwind-full.css" -o "$PKGROOT/_compiled.css" --minify 2>/dev/null
if [ ! -s "$PKGROOT/_compiled.css" ]; then
  echo "tailwind compile failed — is @tailwindcss/cli installed under the app? (npm i)" >&2
  exit 1
fi
echo "compiled full utility CSS -> _compiled.css ($(wc -c < "$PKGROOT/_compiled.css") bytes)"

# The in-node_modules symlink makes PKG_DIR = <node-modules>/eudr-frontend resolve
# to pkgroot. Gitignored; recreated here.
ln -sfn "$PKGROOT" "$APP/node_modules/eudr-frontend"
echo "pkgroot ready at $PKGROOT"
