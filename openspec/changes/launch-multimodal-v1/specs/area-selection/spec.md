# area-selection

## ADDED Requirements

### Requirement: Global pin-drop area selection
The system SHALL let users choose any location worldwide via geocoding search or map
pin, deriving the working bbox from the pin and target route length. Hardcoded
neighborhood lists SHALL NOT be required for generation.

#### Scenario: Search a city
- **WHEN** a user searches "San Francisco" and drops a pin in the Mission
- **THEN** generation runs against a bbox centered on the pin, sized to the target
  route length, with no Prague-specific data involved

#### Scenario: Target length drives bbox
- **WHEN** a user selects a 5 km target route
- **THEN** the working bbox is proportionally smaller than for a 20 km target

### Requirement: Street-density sanity check
The system SHALL verify a candidate area has sufficient routable street density
before generation and SHALL explain rejection with actionable guidance.

#### Scenario: Sparse area rejected
- **WHEN** a user drops a pin in open countryside
- **THEN** generation is refused before any LLM/routing spend, with a message to
  choose a denser street grid or enlarge the area
