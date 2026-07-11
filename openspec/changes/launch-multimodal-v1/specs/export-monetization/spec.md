# export-monetization

## ADDED Requirements

### Requirement: Free previews, paid GPX export
The system SHALL allow unlimited on-map route previews at no charge (subject to
rate limits) and SHALL require a credit to download GPX. Credits are sold as packs
through a merchant-of-record (Polar) and delivered as license keys; the server SHALL
validate and decrement keys via the Polar API on every export.

#### Scenario: Export with valid key
- **WHEN** a user with a license key holding ≥1 credit exports a route
- **THEN** the GPX downloads, exactly one credit is decremented server-side, and the
  remaining balance is shown

#### Scenario: Exhausted key
- **WHEN** a user's key has 0 credits and they attempt export
- **THEN** the export is blocked with a purchase call-to-action; no GPX is delivered

### Requirement: Quality-gated export
The system SHALL only permit (and therefore charge for) export of routes whose
validator score meets the similarity threshold.

#### Scenario: Failing route not chargeable
- **WHEN** a generated route scores below the validation threshold after retries
- **THEN** export is unavailable for that route and no credit can be consumed on it

### Requirement: Free-tier trial exports
The system SHALL grant a small number of free exports per session without any
account, tracked via a signed session token.

#### Scenario: First-time user
- **WHEN** a new visitor generates a route and exports it
- **THEN** the export succeeds using a free-tier allowance and the remaining free
  count is displayed

### Requirement: Preview rate limiting
The system SHALL rate-limit route generation per session at the gateway layer to cap
Mapbox and LLM cost exposure from free usage.

#### Scenario: Burst generation
- **WHEN** a session exceeds the per-minute generation limit
- **THEN** further requests are rejected with a clear retry-after message
