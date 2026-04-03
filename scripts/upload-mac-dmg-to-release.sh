#!/usr/bin/env bash
# Upload macOS DMGs (Intel + Apple Silicon) to an existing GitHub Release.
# Prerequisites: `gh` CLI authenticated (`gh auth login`), `npm run build:mac` already run.
set -euo pipefail

TAG="${1:-v0.10.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GH="${GH_BIN:-$(command -v gh || true)}"
if [[ -z "$GH" || ! -x "$GH" ]]; then
  if [[ -x /usr/local/bin/gh ]]; then GH=/usr/local/bin/gh
  elif [[ -x /opt/homebrew/bin/gh ]]; then GH=/opt/homebrew/bin/gh
  else echo "Install GitHub CLI: https://cli.github.com/"; exit 1; fi
fi

X64="$ROOT/dist/Sync-Multi-Chat-Setup-${TAG#v}-x64.dmg"
ARM="$ROOT/dist/Sync-Multi-Chat-Setup-${TAG#v}-arm64.dmg"

for f in "$X64" "$ARM"; do
  [[ -f "$f" ]] || { echo "Missing: $f — run: npm run build:mac"; exit 1; }
done

echo "Uploading to release $TAG ..."
"$GH" release upload "$TAG" "$X64" "$ARM" --clobber
echo "Done."
"$GH" release view "$TAG" --json assets --jq '.assets[].name'
