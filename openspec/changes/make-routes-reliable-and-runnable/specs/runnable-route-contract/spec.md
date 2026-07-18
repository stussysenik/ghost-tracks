# runnable-route-contract

## ADDED Requirements

### Requirement: Closed-loop routes

Every route generated from a **closed outline** SHALL start and end at the same graph node, closed through the road network using the same short-hop routing technique. A route generated from an **open outline** SHALL be left open, ending where the stroke ends, and SHALL be reported as point-to-point rather than as a failed loop.

Closure is a property of the drawn shape, not something the router imposes. Forcing an open letterform shut appends 0.73–1.71 km of ground the drawing does not contain (measured across the M/W/X/Z/H fixtures, 12–28% of their distance targets), which would buy a green loop metric at the cost of the distance and repeat-ratio contracts below.

#### Scenario: Loop closure

- **WHEN** a route is generated from an outline whose ends meet (within 50 m)
- **THEN** the route's first and last coordinates are the same graph node

#### Scenario: Open stroke left honest

- **WHEN** a route is generated from an open outline, such as the letter M
- **THEN** the route ends at the stroke's end rather than being padded with a return leg
- **AND** the eval scores closure only over closed-outline fixtures

### Requirement: Target distance

The system SHALL accept a user-set target distance and scale the shape's geographic footprint so the measured route length is within ±10% of target, iterating on measured length at most 3 times, and SHALL surface the actual measured distance when only best-effort is achievable.

#### Scenario: Distance hit

- **WHEN** a user requests a 10 km route for an expressible shape in a dense area
- **THEN** the returned route's measured length is between 9 and 11 km

#### Scenario: Honest best-effort

- **WHEN** the network cannot support the target within 3 iterations
- **THEN** the closest achievable route is returned with its true measured distance and a best-effort indicator

### Requirement: Repeated-street penalty

The routing cost function SHALL escalate the cost of an edge on each prior traversal within the same route, and the route response SHALL report its repeat ratio (repeated edge length / total length).

#### Scenario: Doubling discouraged and reported

- **WHEN** a shape could be routed either by doubling back along one street or via an adjacent parallel street at similar cost
- **THEN** the router prefers the non-repeated alternative
- **AND** the response includes the route's repeat ratio
