package services

import com.graphhopper.GraphHopper
import com.graphhopper.config.{LMProfile, Profile}
import com.graphhopper.matching.{MapMatching, MatchResult, Observation}
import com.graphhopper.util.{CustomModel, PMap}
import com.graphhopper.util.shapes.GHPoint

import javax.inject.{Inject, Singleton}
import play.api.{Configuration, Logger}
import scala.jdk.CollectionConverters._

/** Plain result from the matcher: dense road-snapped coords + length/time in base units. */
final case class MatchOutput(
  coordinates: Seq[Seq[Double]], // [lng, lat] pairs
  distanceMeters: Double,
  durationMillis: Long
)

/**
 * Wraps GraphHopper map-matching over a LOCAL OpenStreetMap graph.
 *
 * Why this exists: Ghost Tracks previously snapped shapes to roads via the Mapbox Directions
 * API — a remote, non-deterministic black box. Map-matching against a fixed local OSM extract
 * with a pinned GraphHopper version and a fixed measurement-error sigma is fully DETERMINISTIC:
 * identical input ⇒ identical output, every time. That reproducibility is the whole point.
 *
 * How map-matching works here: the incoming waypoints (already densified to ~80m spacing by the
 * Python StreetMapper) are treated as a synthetic GPS trace. GraphHopper runs a Hidden Markov
 * Model (Newson & Krumm) to find the most likely *road* path through that trace — snapping the
 * drawn shape onto streets a runner can actually follow.
 *
 * The graph is built once at boot (eager singleton, see app/Module.scala) and cached on disk.
 */
@Singleton
class GraphHopperService @Inject() (config: Configuration) {

  private val logger = Logger(this.getClass)

  private val osmFile     = config.get[String]("matcher.osmFile")
  private val graphCache  = config.get[String]("matcher.graphCache")
  private val profileName = config.get[String]("matcher.profile")
  private val sigma       = config.getOptional[Double]("matcher.measurementErrorSigma").getOrElse(40.0)

  // Built eagerly at construction. importOrLoad() imports the .pbf on first run (slow, minutes)
  // then loads the on-disk cache on subsequent boots (fast).
  private val hopper: GraphHopper = {
    val gh = new GraphHopper()
    gh.setOSMFile(osmFile)
    gh.setGraphHopperLocation(graphCache)
    // A single flexible foot profile. GraphHopper 8 removed weighting="fastest" — it requires
    // weighting="custom" with a CustomModel. An EMPTY custom model defaults to the foot vehicle's
    // own speed/priority, which is exactly what we want. Landmarks (LM) speed up flexible queries
    // without the route-fixing that Contraction Hierarchies impose — map-matching needs flexibility.
    gh.setProfiles(
      new Profile(profileName)
        .setVehicle("foot")
        .setWeighting("custom")
        .setCustomModel(new CustomModel())
    )
    gh.getLMPreparationHandler.setLMProfiles(new LMProfile(profileName))

    logger.info(s"GraphHopper: importing/loading graph (osm=$osmFile, cache=$graphCache)…")
    gh.importOrLoad()
    logger.info("GraphHopper: graph ready.")
    gh
  }

  /**
   * Snap a sequence of [lng, lat] waypoints onto the road network.
   *
   * @param waypoints (lng, lat) pairs — GeoJSON order, as used throughout Ghost Tracks.
   * @return dense road-following coordinates plus total distance/time.
   */
  def matchTrace(waypoints: Seq[(Double, Double)]): MatchOutput = {
    val hints = new PMap().putObject("profile", profileName)
    val mm = MapMatching.fromGraphHopper(hopper, hints)
    mm.setMeasurementErrorSigma(sigma)

    // GHPoint is (lat, lon) — note the swap from our (lng, lat) input.
    val observations: java.util.List[Observation] =
      waypoints.map { case (lng, lat) => new Observation(new GHPoint(lat, lng)) }.asJava

    // `match` is a Scala keyword, so the Java method is called with backticks.
    val mr: MatchResult = mm.`match`(observations)

    val path = mr.getMergedPath
    val pl = path.calcPoints()
    val coords = (0 until pl.size()).map(i => Seq(pl.getLon(i), pl.getLat(i)))

    MatchOutput(coords, path.getDistance, path.getTime)
  }
}
