# multimodal-input

## ADDED Requirements

### Requirement: Image upload produces a routable shape
The system SHALL accept a raster image upload (PNG/JPEG/WebP) and extract a
principal polyline via deterministic vectorization (vtracer/skeletonization), which
then flows through the existing shape→street mapping pipeline. LLM vision MAY assist
stroke selection but SHALL NOT generate the path geometry.

#### Scenario: Clean line drawing
- **WHEN** a user uploads a high-contrast single-subject line drawing (e.g. a heart)
- **THEN** the extracted shape is previewed before snapping, and a snapped route is
  generated in the selected area using the existing pipeline and validator

#### Scenario: Unsuitable image
- **WHEN** a user uploads an image from which no usable stroke can be extracted
  (e.g. a low-contrast photo)
- **THEN** the system explains why and suggests uploading a simpler, high-contrast
  drawing, without consuming any credit or LLM budget on route generation

### Requirement: SVG upload produces a routable shape
The system SHALL accept an SVG file, sample its path(s) by arc length into control
points, and route them through the same pipeline as image upload.

#### Scenario: Single-path SVG
- **WHEN** a user uploads an SVG containing one path
- **THEN** a snapped route preview is generated from that path's sampled points

### Requirement: Draw-on-map canvas input
The system SHALL let a user draw a freehand shape directly over the map, simplify it
(Douglas-Peucker), and snap it via the same pipeline. This modality is sequenced
last and MAY ship after the other modalities.

#### Scenario: Freehand loop
- **WHEN** a user draws a closed loop over their neighborhood and confirms
- **THEN** the drawing is simplified and snapped to streets with a live preview

### Requirement: Unified mode selection
The system SHALL present text, image, SVG, and draw inputs as modes of one flow
sharing area selection, preview, validation, and export.

#### Scenario: Switching modality preserves area
- **WHEN** a user switches from text mode to image mode
- **THEN** the selected area and route-length settings are preserved
