# llm-inference

## ADDED Requirements

### Requirement: Single-provider LLM stack on Cerebras
The system SHALL use Cerebras-hosted Gemma 4 31B via its OpenAI-compatible endpoint
for all LLM roles: text→shape generation, area reasoning, vision-based judging, and
image-input assistance. zhipuai, NVIDIA NIM, and direct OpenAI provider paths SHALL
be removed. Provider selection SHALL remain a configuration concern (base_url/model)
so a fallback swap requires no code change.

#### Scenario: Text-to-shape via Cerebras
- **WHEN** a user describes "a cat" in Describe mode
- **THEN** control points are produced by Gemma 4 31B through the configured
  Cerebras endpoint, with the parametric template fallback preserved on API failure

#### Scenario: Vision judging via Cerebras
- **WHEN** a generated route completes and needs similarity scoring
- **THEN** the rasterized route and intended shape are judged by Gemma 4 31B vision,
  blended with the algorithmic score exactly as the current GLM-4V path is

#### Scenario: Provider outage
- **WHEN** the Cerebras endpoint is unavailable
- **THEN** generation degrades to parametric templates and algorithmic-only
  validation, and the user is informed that AI features are temporarily reduced
