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
# bounded to PKG_DIR's realpath, so copy a REAL file into pkgroot (a symlink to
# .next/ would realpath outside the bound and get skipped). Pick the largest
# compiled chunk — that's the app stylesheet carrying tokens + utilities.
CSS="$(find "$APP/.next/static/chunks" -name '*.css' 2>/dev/null | xargs ls -S 2>/dev/null | head -1)"
if [ -z "${CSS:-}" ]; then
  echo "no compiled CSS under .next/static/chunks — run 'npm run build' first" >&2
  exit 1
fi
cp "$CSS" "$PKGROOT/_compiled.css"
echo "copied compiled CSS: $CSS -> _compiled.css ($(wc -c < "$PKGROOT/_compiled.css") bytes)"

# The in-node_modules symlink makes PKG_DIR = <node-modules>/eudr-frontend resolve
# to pkgroot. Gitignored; recreated here.
ln -sfn "$PKGROOT" "$APP/node_modules/eudr-frontend"
echo "pkgroot ready at $PKGROOT"
