# workout-planner

## ADDED Requirements

### Requirement: Multi-run plans

The system SHALL compose workout plans as an ordered set of runs across a chosen period (e.g., a week), where every run's route satisfies the runnable-route contract (see capability `runnable-route-contract`), shares a common start anchor, and follows a plan theme — either one shape per run or one composition segmented across runs.

#### Scenario: Weekly plan generation

- **WHEN** a user requests a 3-run weekly plan (e.g., 5 km / 8 km / 12 km) from a start anchor and a shape theme
- **THEN** three routes are returned, each satisfying loop closure and its per-run distance target, each starting and ending at the anchor

#### Scenario: Segmented composition covers the shape

- **WHEN** a plan uses one composition segmented across runs
- **THEN** the union of the runs' shape segments covers the full composition with no segment assigned to more than one run

### Requirement: Pace and elevation targets

Each run in a plan SHALL carry an elevation profile derived from graph elevation data and a pace target derived from user input, presented as annotations; targets SHALL NOT alter routing beyond selecting among contract-satisfying candidate routes.

#### Scenario: Annotated run

- **WHEN** a plan is generated for a user who provided a pace
- **THEN** each run includes total ascent and an estimated duration from distance and pace

### Requirement: Plan export

Each run in a plan SHALL be individually exportable as a GPX file identical in format to single-route export.

#### Scenario: Export one run

- **WHEN** the user exports the second run of a plan
- **THEN** a GPX file for exactly that run's route is produced
