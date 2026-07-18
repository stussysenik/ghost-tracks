"""One-time builder: download the 3 pinned area walk-networks, commit them.

This is the ONLY online step Task 2 adds (the graph analogue of
`record_baseline.py`). It materializes each pinned area's OSM walk-network into
`eval/fixtures/graphs/<key>.graphml` via `RoadGraph.for_bbox`, so eval and tests
replay the committed extracts fully offline (`allow_download=False`). Run once:

    python -m eval.build_graphs            # download + cache all 3 areas
    python -m eval.build_graphs --dry-run  # print plan, no network

Re-running is a no-op for already-cached areas; delete the .graphml to refresh.
"""

from __future__ import annotations

import sys

from eval.fixtures import AREAS, GRAPHS_DIR
from services.road_graph import RoadGraph, cache_key


def build_all(dry_run: bool = False) -> None:
    GRAPHS_DIR.mkdir(parents=True, exist_ok=True)
    for area in AREAS.values():
        path = GRAPHS_DIR / f"{cache_key(area.bbox)}.graphml"
        status = "cached" if path.exists() else "download"
        print(f"{area.key:<12} {area.tier:<11} {status:<8} -> {path.name}")
        if dry_run or path.exists():
            continue
        graph = RoadGraph.for_bbox(area.bbox, cache_dir=GRAPHS_DIR)
        print(f"  -> {len(graph)} nodes, {graph.graph.number_of_edges()} edges")

    if not dry_run:
        print(f"\nGraphs in {GRAPHS_DIR}")


if __name__ == "__main__":
    build_all(dry_run="--dry-run" in sys.argv)
