package controllers

import javax.inject.{Inject, Singleton}
import play.api.Logger
import play.api.libs.json._
import play.api.mvc._
import services.GraphHopperService
import models.{MatchRequest, MatchResponse}

/**
 * HTTP surface for the matcher service.
 *
 * `POST /match` takes a densified [lng, lat] trace and returns a deterministic road-snapped
 * route, in the exact JSON shape Ghost Tracks already expects from its Mapbox routing path.
 */
@Singleton
class MatchController @Inject() (cc: ControllerComponents, gh: GraphHopperService)
    extends AbstractController(cc) {

  private val logger = Logger(this.getClass)

  def health(): Action[AnyContent] = Action {
    Ok(Json.obj("status" -> "ok"))
  }

  /** Named `matchRoute` because `match` is a Scala reserved word. */
  def matchRoute(): Action[JsValue] = Action(parse.json) { request =>
    request.body.validate[MatchRequest].fold(
      _ => BadRequest(Json.toJson(MatchResponse.failure("invalid request body: expected { waypoints: [[lng,lat],…] }"))),
      req => {
        // Keep only well-formed [lng, lat] pairs.
        val pts: Seq[(Double, Double)] = req.waypoints.collect { case Seq(lng, lat) => (lng, lat) }

        if (pts.size < 2) {
          BadRequest(Json.toJson(MatchResponse.failure("need at least 2 valid [lng,lat] waypoints")))
        } else {
          try {
            val out = gh.matchTrace(pts)
            val resp = MatchResponse(
              coordinates      = out.coordinates,
              distance_km      = out.distanceMeters / 1000.0,
              duration_minutes = math.round(out.durationMillis / 60000.0).toInt,
              success          = true,
              error            = None
            )
            Ok(Json.toJson(resp))
          } catch {
            case e: Throwable =>
              // Map-matching can fail when a trace can't be matched to roads (e.g. off-graph).
              // Mirror Mapbox's soft-failure: 200 with success=false so callers can fall back.
              logger.warn(s"match failed for ${pts.size} waypoints: ${e.getMessage}")
              Ok(Json.toJson(MatchResponse.failure(e.getMessage)))
          }
        }
      }
    )
  }
}
