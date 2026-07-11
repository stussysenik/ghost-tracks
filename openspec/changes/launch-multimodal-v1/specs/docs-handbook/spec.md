# docs-handbook

## ADDED Requirements

### Requirement: In-app programmer's handbook
The system SHALL serve a developer handbook at `/docs`, rendered from mdsvex (`.svx`)
sources, documenting: the generation pipeline (shape → street mapping → validation →
GPX), the scoring math and thresholds, HTTP API contracts, the environment-key
manifest, and per-modality guides. Documentation SHALL be updated in the same change
that alters the behavior it describes.

#### Scenario: Reading the pipeline doc
- **WHEN** a developer opens `/docs` locally
- **THEN** they can navigate rendered handbook pages covering pipeline, scoring,
  API contracts, and required environment keys

#### Scenario: Truthful README
- **WHEN** a reader compares README claims against the codebase
- **THEN** every claimed component exists and is wired into the running system
