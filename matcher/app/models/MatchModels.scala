package models

import play.api.libs.json._

/**
 * Request/response models for `POST /match`.
 *
 * These deliberately MIRROR the existing Mapbox route contract used by Ghost Tracks
 * (`src/lib/services/routing.ts` `DirectionsResult` and `src/routes/api/route/+server.ts`)
 * so this service is a drop-in routing backend with zero frontend changes.
 *
 * Coordinates are GeoJSON order — [longitude, latitude] — everywhere, matching the
 * rest of the codebase.
 */

/** Incoming trace: a sequence of [lng, lat] waypoints, already densified by the Python
  * backend's StreetMapper. `profile` is accepted for parity but the service is foot-only today. */
case class MatchRequest(
  waypoints: Seq[Seq[Double]],
  profile: Option[String]
)

object MatchRequest {
  implicit val format: Format[MatchRequest] = Json.format[MatchRequest]
}

/** Road-snapped result. Field names use snake_case to match the existing JSON contract. */
case class MatchResponse(
  coordinates: Seq[Seq[Double]], // dense [lng, lat] points following real streets
  distance_km: Double,
  duration_minutes: Int,
  success: Boolean,
  error: Option[String]
)

object MatchResponse {
  implicit val format: Format[MatchResponse] = Json.format[MatchResponse]

  /** Convenience for the failure path — keeps the same shape so callers never special-case. */
  def failure(message: String): MatchResponse =
    MatchResponse(Seq.empty, 0.0, 0, success = false, error = Some(message))
}
