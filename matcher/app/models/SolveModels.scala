package models

import play.api.libs.json._

/**
 * Request/response models for `POST /solve` — the art-route solving endpoint.
 *
 * `/solve` extends `/match` with the two things GPS art needs beyond plain snapping:
 *
 *   1. **Loop closure** — closed shapes (hearts!) read best and loop naturally. If the
 *      caller asks for a loop and the trace doesn't already end where it starts, we append
 *      the first point so map-matching naturally routes back to the start.
 *   2. **Segment provenance** — the Python composer knows which parts of the trace are
 *      glyph strokes vs. connectors vs. retraces. The matched output has *different*
 *      coordinates (denser, street-snapped), so we re-express those ranges over the
 *      output. The frontend uses this to render connectors/retraces differently.
 *
 * Coordinates are GeoJSON order — [longitude, latitude] — everywhere, matching the rest
 * of the codebase. Request fields are camelCase (sent by the Python brain); response
 * fields are snake_case (mirroring the established `/match` contract).
 */

/**
 * A half-open-ish provenance range, expressed as INCLUSIVE indices that TILE the
 * polyline: segment i's `endIdx` equals segment i+1's `startIdx` (they share the
 * boundary vertex), the first `startIdx` is 0 and the last `endIdx` is the final
 * coordinate index. The same shape is used for ranges over the input trace (request)
 * and over the matched coordinates (response).
 */
case class SegmentRange(
  kind: String,     // "glyph" | "shape" | "connector" | … — opaque to the kernel
  retrace: Boolean, // true ⇒ this range re-walks earlier geometry (visually disappears)
  startIdx: Int,    // inclusive index of the first vertex of this segment
  endIdx: Int       // inclusive index of the last vertex (== next segment's startIdx)
)

object SegmentRange {
  implicit val format: Format[SegmentRange] = Json.format[SegmentRange]
}

/** Incoming solve request: a densified (~80 m) continuous [lng, lat] polyline plus options. */
case class SolveRequest(
  trace: Seq[Seq[Double]],            // [[lng, lat], …] — the composed continuous line
  profile: Option[String],            // optional; default (and only supported) "foot"
  closeLoop: Option[Boolean],         // optional; default false
  segments: Option[Seq[SegmentRange]] // optional provenance ranges over `trace` indices
)

object SolveRequest {
  implicit val format: Format[SolveRequest] = Json.format[SolveRequest]
}

/**
 * Street-matched result. Always returned with HTTP 200 — failures are "soft"
 * (success=false + actionable error) so the Python tighten-loop can react without
 * exception plumbing, exactly like `/match`.
 */
case class SolveResponse(
  coordinates: Seq[Seq[Double]],  // dense [lng, lat] points following real streets
  segments: Seq[SegmentRange],    // provenance ranges re-expressed over `coordinates`
  distance_km: Double,
  duration_minutes: Double,
  success: Boolean,
  error: Option[String]
)

object SolveResponse {
  // WritesNull makes `error: None` serialize as an explicit `"error": null` instead of
  // omitting the field. Two reasons: (a) the documented contract shows the field, and
  // (b) determinism — the response always has the same six fields in the same order
  // (Play JSON macro Writes emit fields in case-class declaration order, and JsObject
  // preserves insertion order), so identical inputs yield byte-identical JSON.
  implicit val jsonConfig: JsonConfiguration =
    JsonConfiguration(optionHandlers = OptionHandlers.WritesNull)

  implicit val format: Format[SolveResponse] = Json.format[SolveResponse]

  /** Convenience for the failure path — same shape, so callers never special-case. */
  def failure(message: String): SolveResponse =
    SolveResponse(Seq.empty, Seq.empty, 0.0, 0.0, success = false, error = Some(message))
}
