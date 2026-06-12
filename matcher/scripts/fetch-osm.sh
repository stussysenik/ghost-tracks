#!/usr/bin/env bash
# Download a city-sized OpenStreetMap extract for the matcher's local routing graph.
#
# Default = Prague (the Ghost Tracks map is centered on [14.4378, 50.0755]). A city extract
# keeps the GraphHopper import fast; a whole-country Geofabrik file would be needlessly large.
set -euo pipefail

DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/data"
mkdir -p "$DATA_DIR"

# BBBike lists Prague under its German name "Prag".
OUT="$DATA_DIR/Prague.osm.pbf"
URL="https://download.bbbike.org/osm/bbbike/Prag/Prag.osm.pbf"

if [ -f "$OUT" ]; then
  echo "OSM extract already present: $OUT"
  exit 0
fi

echo "Downloading Prague OSM extract → $OUT"
curl -fSL "$URL" -o "$OUT"
echo "Done ($(du -h "$OUT" | cut -f1))."
