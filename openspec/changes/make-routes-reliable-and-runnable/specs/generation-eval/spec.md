# generation-eval

## ADDED Requirements

### Requirement: Per-stage generation benchmark

The system SHALL provide an offline, deterministic evaluation harness that scores every pipeline stage — extraction fidelity (IoU vs. source silhouette), snap fidelity (discrete Fréchet and Hausdorff vs. target polyline), and runnability (loop closure, distance error, repeat ratio) — over a versioned fixture set of shapes and cached OSM extracts, without any network calls.

#### Scenario: Scoreboard run

- **WHEN** a developer runs `pytest -m eval`
- **THEN** every fixture shape is processed through each pipeline stage against cached OSM extracts
- **AND** a per-stage scoreboard (JSON and human-readable) is produced
- **AND** the run completes with no network access and identical scores across repeated runs

#### Scenario: Regression gate

- **WHEN** a change causes any stage's aggregate score to fall below the committed baseline scoreboard
- **THEN** the eval run fails with the failing stage, fixture, and metric named

### Requirement: Failure fixtures from real usage

The eval fixture set SHALL grow from observed real-world failures: any shape a user reports as failing MUST be addable as a fixture with only a manifest entry and asset file, becoming part of the regression suite.

#### Scenario: Adding a failure case

- **WHEN** a user-reported failing shape is added to the fixture manifest with its source image
- **THEN** the next eval run scores it across all stages with no code changes required
