# runnable-route-contract

## ADDED Requirements

### Requirement: Closed-loop routes

Every generated route SHALL start and end at the same graph node, closed through the road network using the same short-hop routing technique.

#### Scenario: Loop closure

- **WHEN** any route is generated from any fixture or user shape
- **THEN** the route's first and last coordinates are the same graph node

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
