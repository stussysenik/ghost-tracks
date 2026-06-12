package controllers

import javax.inject.{Inject, Singleton}
import play.api.Logger
import play.api.libs.json._
import play.api.mvc._
import services.{GraphHopperService, SolveLogic}
import models.{SolveRequest, SolveResponse}

/**
 * HTTP surface for `POST /solve` — the art-route endpoint the Python brain drives.
 *
 * This is the "imperative shell": parse JSON, run the pure pipeline from SolveLogic
 * (validate → close loop → … → provenance mapping), with exactly ONE effectful step in
 * the middle — `GraphHopperService.matchTrace`, the same matching path `/match` uses, so
 * the two endpoints can never drift apart in snapping behavior.
 *
 * Contract decisions worth knowing:
 *  - ALWAYS HTTP 200. Failures are soft (`success: false` + actionable error) so the
 *    Python score/tighten loop can react to "move/rescale" advice without exception
 *    plumbing — same philosophy as `/match`.
 *  - DETERMINISTIC. No timestamps, no randomness; field order is fixed by the case-class
 *    Writes. Same request body ⇒ byte-identical response (a tested MVP acceptance
 *    criterion: "same input ⇒ identical route").
 */
@Singleton
class SolveController @Inject() (cc: ControllerComponents, gh: GraphHopperService)
    extends AbstractController(cc) {

  private val logger = Logger(this.getClass)

  def solve(): Action[JsValue] = Action(parse.json) { request =>
    val response = request.body.validate[SolveRequest].fold(
      _ => SolveResponse.failure(
        "invalid request body: expected { trace: [[lng,lat],…], profile?, closeLoop?, segments? }"),
      handle
    )
    Ok(Json.toJson(response))
  }

  /** Pure pipeline around the single map-matching call. */
  private def handle(req: SolveRequest): SolveResponse =
    SolveLogic.validateTrace(req.trace) match {
      case Left(error) => SolveResponse.failure(error)
      case Right(pts) =>
        // `profile` is accepted for forward-compatibility but the graph is foot-only today
        // (same as /match) — a non-foot profile would need its own GraphHopper profile.
        val inputSegments = req.segments.getOrElse(SolveLogic.defaultSegments(pts.size))
        SolveLogic.validateSegments(inputSegments, pts.size) match {
          case Some(error) => SolveResponse.failure(error)
          case None =>
            val trace = SolveLogic.closeLoop(pts, req.closeLoop.getOrElse(false))
            try {
              val out = gh.matchTrace(trace)
              val outPts = out.coordinates.collect { case Seq(lng, lat) => (lng, lat) }
              if (outPts.size < 2)
                SolveResponse.failure(
                  "matched route is degenerate (fewer than 2 points) — scale up the placement so strokes exceed one street block")
              else {
                // Re-express the composer's provenance ranges over the street-matched line.
                val assignment = SolveLogic.assignOutputsToInputs(trace, outPts)
                val segments = SolveLogic.mapSegments(inputSegments, assignment, outPts.size)
                SolveResponse(
                  coordinates      = out.coordinates,
                  segments         = segments,
                  distance_km      = out.distanceMeters / 1000.0,
                  duration_minutes = out.durationMillis / 60000.0,
                  success          = true,
                  error            = None
                )
              }
            } catch {
              case e: Throwable =>
                logger.warn(s"solve failed for ${trace.size} trace points: ${e.getMessage}")
                SolveResponse.failure(SolveLogic.actionableError(e.getMessage))
            }
        }
    }
}
