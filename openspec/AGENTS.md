# AGENTS.md — Ghost Tracks (haxe experimental)

This repo is an **experimental sandbox** for building Ghost Tracks under the **haxe methodology**.
Everything here is provisional — code, architecture, and decisions evolve fast.

## haxe methodology

1. **Openspec-driven.** Proposals → Design → Tasks → Specs. Every change starts with a proposal.
2. **Atomic batching (<100 LOC per commit).** Small, focused, verifiable.
3. **Two-deployable topology.** SvelteKit (gateway) + FastAPI (backend). No third runtime.
4. **CV extraction is deterministic.** LLM assists but never draws the path.
5. **Single LLM provider.** Cerebras Gemma 4 31B for all roles. Falls back to manual config.
6. **Export is the paid action.** Free previews, paid GPX. Quality-gated: never charge for a bad route.
7. **No auth, no DB.** License keys via Polar. Session cookies for free-tier tracking.
8. **Experimental first.** This repo is where we try things. If they work, they graduate.

## Project state

- **Current version:** v2.1 (dynamic AI pipeline, global area, PWA)
- **Active change:** `launch-multimodal-v1` (~70% complete)
- **Remaining:** image/SVG upload, canvas draw, Polar monetization, docs handbook

## Working with this repo

- Always read `openspec/changes/` before making changes — the active change defines the task graph.
- Run `npm run doctor` before dev. Keep `.env.example` in sync.
- CI must pass (oxlint + svelte-check + pytest) before commit.
- When a task is complete, mark it `[x]` in the tasks file.
- Archive completed changes to `openspec/changes/ARCHIVED/`.
