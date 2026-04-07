#!/usr/bin/env bash
# Upload macOS release artifacts (DMG + updater metadata) to an existing GitHub Release.
# Prerequisites: `gh` CLI authenticated (`gh auth login`), `npm run build:mac` already run.
set -euo pipefail

TAG="${1:-v0.10.1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GH="${GH_BIN:-$(command -v gh || true)}"
if [[ -z "$GH" || ! -x "$GH" ]]; then
  if [[ -x /usr/local/bin/gh ]]; then GH=/usr/local/bin/gh
  elif [[ -x /opt/homebrew/bin/gh ]]; then GH=/opt/homebrew/bin/gh
  else echo "Install GitHub CLI: https://cli.github.com/"; exit 1; fi
fi

X64="$ROOT/dist/Sync-Multi-Chat-Setup-${TAG#v}-x64.dmg"
ARM="$ROOT/dist/Sync-Multi-Chat-Setup-${TAG#v}-arm64.dmg"
X64_ZIP="$ROOT/dist/Sync-Multi-Chat-Setup-${TAG#v}-x64.zip"
ARM_ZIP="$ROOT/dist/Sync-Multi-Chat-Setup-${TAG#v}-arm64.zip"
LATEST_MAC="$ROOT/dist/latest-mac.yml"

for f in "$X64" "$ARM" "$X64_ZIP" "$ARM_ZIP" "$LATEST_MAC"; do
  [[ -f "$f" ]] || { echo "Missing: $f — run: npm run build:mac"; exit 1; }
done

echo "Uploading to release $TAG ..."
"$GH" release upload "$TAG" \
  "$ROOT"/dist/latest-mac*.yml \
  "$X64_ZIP" \
  "$ARM_ZIP" \
  "$X64_ZIP".blockmap \
  "$ARM_ZIP".blockmap \
  "$X64" \
  "$ARM" \
  --clobber
echo "Done."
"$GH" release view "$TAG" --json assets --jq '.assets[].name'
