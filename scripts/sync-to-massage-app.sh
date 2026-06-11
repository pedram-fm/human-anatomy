#!/usr/bin/env bash
# muscle-anatomy is the SOURCE OF TRUTH for the 3D anatomy viewer.
# This script copies the viewer core + assets into massage-app's developer panel.
#
# The synced files are byte-identical in both projects: intra-feature imports are
# relative (../store, ../data, ./Component) and the UI kit import (@/components/ui/*)
# resolves to each project's own shadcn components. Project-specific things stay
# downstream (massage-app): the /developer/anatomy/page.tsx wrapper, the nav item,
# and dependency wiring.
#
# Usage: scripts/sync-to-massage-app.sh
#        MASSAGE_APP_DIR=/path/to/massage-app scripts/sync-to-massage-app.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DST="${MASSAGE_APP_DIR:-$HOME/Desktop/projects/massage-app}/massage-app-frontend"
FEATURE="$DST/app/developer/anatomy"

[ -d "$FEATURE" ] || { echo "target not found: $FEATURE" >&2; exit 1; }

# Viewer core (components except the project-local ui kit, store, data+catalogs)
rsync -a --delete --exclude 'ui/' "$SRC/src/components/" "$FEATURE/components/"
rsync -a --delete "$SRC/src/store/" "$FEATURE/store/"
rsync -a --delete --exclude '*.backup.*' "$SRC/src/data/" "$FEATURE/data/"

# Assets: the 9 system GLBs referenced by the catalog + the self-hosted Draco decoder
mkdir -p "$DST/public/models" "$DST/public/draco"
for sys in skeletal muscular regions nervous cardiovascular visceral lymphoid joints insertions; do
  cp "$SRC/public/models/$sys.glb" "$DST/public/models/"
done
cp "$SRC/public/draco/"* "$DST/public/draco/"

echo "synced viewer core + assets to $FEATURE"
echo "next: run typecheck/lint in massage-app:"
echo "  docker exec next_app npx tsc --noEmit && docker exec next_app npx eslint app/developer/anatomy"
