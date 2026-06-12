#!/usr/bin/env bash
# Run the full Ghost Tracks stack for local development.
#
# Architecture (openspec/changes/strava-art-mvp): four runtimes, fixed roles —
#   kernel  :8080  Scala Play + GraphHopper  (deterministic street solve)
#   brain   :8000  Python FastAPI            (intent → StrokeSet IR → compose)
#   gateway :3000  Hono on Bun               (BFF: validation, timeouts, shares)
#   web     :5180  React + Vite              (product surface)
#
# Usage: ./scripts/dev-all.sh        # starts all four, Ctrl-C stops all
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pids=()
cleanup() { echo; echo "stopping stack…"; kill "${pids[@]}" 2>/dev/null || true; wait 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "▸ kernel  :8080  (first boot imports OSM — takes minutes; later boots are fast)"
(cd "$ROOT/matcher" && exec sbt -warn run) & pids+=($!)

echo "▸ brain   :8000"
(cd "$ROOT/backend" && exec venv/bin/uvicorn main:app --port 8000 --reload) & pids+=($!)

echo "▸ gateway :3000"
(cd "$ROOT/server" && exec bun run --hot index.ts) & pids+=($!)

echo "▸ web     :5180"
(cd "$ROOT/web" && exec npm run dev) & pids+=($!)

echo
echo "stack up → open http://localhost:5180  (Ctrl-C stops everything)"
wait
