package services

import models.SegmentRange

/**
 * PURE solve logic — every function here is deterministic and graph-free.
 *
 * Why a separate object: the GraphHopper graph takes minutes to import and hundreds of MB
 * of RAM, so anything we want to unit-test fast must not touch it. The split mirrors the
 * "functional core, imperative shell" pattern: `SolveLogic` is the core (validation, loop
 * closure, provenance mapping — plain data in, plain data out), and `SolveController` +
 * `GraphHopperService` are the thin shell around the one effectful call (map-matching).
 *
 * Coordinates are (lng, lat) tuples in GeoJSON order throughout, like the rest of the app.
 */
object SolveLogic {

  /** First/last points closer than this are "already a loop" — no closure point appended.
    * ~30 m ≈ one urban GPS-jitter envelope; closer than that the gap is invisible anyway. */
  val LoopCloseThresholdMeters: Double = 30.0

  private val EarthRadiusMeters = 6371008.8 // mean Earth radius (IUGG)

  /** Great-circle distance in meters between two (lng, lat) points (haversine formula). */
  def haversineMeters(a: (Double, Double), b: (Double, Double)): Double = {
    val dLat = math.toRadians(b._2 - a._2)
    val dLng = math.toRadians(b._1 - a._1)
    val s = math.pow(math.sin(dLat / 2), 2) +
      math.cos(math.toRadians(a._2)) * math.cos(math.toRadians(b._2)) *
        math.pow(math.sin(dLng / 2), 2)
    2 * EarthRadiusMeters * math.asin(math.min(1.0, math.sqrt(s)))
  }

  // ── Validation ────────────────────────────────────────────────────────────────────────

  /**
   * Validate the raw trace and convert it to (lng, lat) tuples.
   *
   * Every error message is ACTIONABLE — it tells the caller (ultimately the user, via the
   * Python brain's diagnostics) which design knob to turn, per the medium-laws philosophy:
   * adapt and explain, never just reject.
   */
  def validateTrace(trace: Seq[Seq[Double]]): Either[String, Seq[(Double, Double)]] = {
    val pts = trace.collect { case Seq(lng, lat) => (lng, lat) }
    if (pts.size != trace.size)
      Left("malformed trace: every point must be a [lng, lat] pair")
    else if (pts.size < 2)
      Left("trace too short: need at least 2 [lng, lat] points — compose a larger or more detailed shape")
    else
      pts.find { case (lng, lat) => lng < -180 || lng > 180 || lat < -90 || lat > 90 } match {
        case Some((lng, lat)) =>
          Left(f"coordinate out of range: [$lng%s, $lat%s] — expected [lng, lat] (GeoJSON order) with lng in ±180, lat in ±90; check coordinate order and placement")
        case None => Right(pts)
      }
  }

  /**
   * Validate that caller-provided segments exactly tile the input trace:
   * first startIdx = 0, last endIdx = traceLen-1, and consecutive segments share their
   * boundary vertex (seg(i).endIdx == seg(i+1).startIdx). Returns Some(error) if broken.
   */
  def validateSegments(segments: Seq[SegmentRange], traceLen: Int): Option[String] = {
    if (segments.isEmpty)
      Some("segments must be non-empty when provided (omit the field for a single implicit segment)")
    else if (segments.head.startIdx != 0)
      Some(s"segments must start at trace index 0 (got ${segments.head.startIdx})")
    else if (segments.last.endIdx != traceLen - 1)
      Some(s"segments must end at the last trace index ${traceLen - 1} (got ${segments.last.endIdx})")
    else
      segments.zipWithIndex.collectFirst {
        case (s, _) if s.startIdx >= s.endIdx =>
          s"segment '${s.kind}' has empty/inverted range [${s.startIdx}, ${s.endIdx}] — each segment must span at least one edge"
        case (s, i) if i > 0 && segments(i - 1).endIdx != s.startIdx =>
          s"segments must tile the trace: segment $i starts at ${s.startIdx} but segment ${i - 1} ends at ${segments(i - 1).endIdx}"
      }
  }

  // ── Loop closure ──────────────────────────────────────────────────────────────────────

  /**
   * If a loop is requested and the trace doesn't already (approximately) close, append the
   * first point to the end. Map-matching then naturally routes the final leg back to the
   * start — first≈last cycles for free, no special routing mode needed.
   */
  def closeLoop(trace: Seq[(Double, Double)], wantLoop: Boolean): Seq[(Double, Double)] =
    if (wantLoop && trace.size >= 2 && haversineMeters(trace.head, trace.last) > LoopCloseThresholdMeters)
      trace :+ trace.head
    else
      trace

  // ── Segment provenance over the matched output ────────────────────────────────────────

  /**
   * Squared "flat-earth" distance in degrees², with longitude corrected by cos(latitude).
   * Only ever used to COMPARE nearby distances (which input vertex is this output vertex
   * closest to?), so the equirectangular approximation is exact enough — and much cheaper
   * and simpler than haversine in the inner loop.
   */
  private def dist2(a: (Double, Double), b: (Double, Double)): Double = {
    val cosLat = math.cos(math.toRadians((a._2 + b._2) / 2))
    val dx = (a._1 - b._1) * cosLat
    val dy = a._2 - b._2
    dx * dx + dy * dy
  }

  /**
   * Assign each output (matched) coordinate to an input trace index via a MONOTONIC
   * nearest-point sweep: a single input pointer walks forward (never backward) and
   * advances only while the NEXT input vertex is STRICTLY closer to the current output
   * vertex than the current one.
   *
   * Why monotonic: retraced art walks the same streets twice, so a naive global
   * nearest-neighbor would happily map an output point on the second pass back to the
   * first pass's indices, scrambling provenance. Monotonicity encodes the fact that both
   * polylines are traversed in the same order. Why STRICTLY closer: on an exact retrace
   * the later duplicate vertex is *equally* close — a `<=` rule would leap ahead past the
   * whole first pass on the very first point.
   *
   * Returns one input index per output point; the result is non-decreasing by construction.
   */
  def assignOutputsToInputs(
    input: Seq[(Double, Double)],
    output: Seq[(Double, Double)]
  ): IndexedSeq[Int] = {
    val in = input.toIndexedSeq
    var i = 0
    output.toIndexedSeq.map { p =>
      while (i + 1 < in.size && dist2(p, in(i + 1)) < dist2(p, in(i))) i += 1
      i
    }
  }

  /**
   * Re-express input-trace segment ranges over the matched output coordinates.
   *
   * Each interior input boundary b (a shared endIdx/startIdx vertex) becomes the FIRST
   * output index whose assigned input index has reached b. The first boundary is pinned
   * to 0 and the last to outLen-1, and each boundary is clamped to be ≥ the previous one,
   * so the result always tiles the output exactly — the invariant the frontend's
   * stroke/connector legend rendering depends on.
   *
   * Note on loop closure: a closure point appended by `closeLoop` has input index
   * traceLen (past the last segment's endIdx). Because the final boundary is pinned to
   * outLen-1, the closing leg is naturally absorbed into the LAST segment.
   */
  def mapSegments(
    inputSegments: Seq[SegmentRange],
    assignment: IndexedSeq[Int],
    outLen: Int
  ): Seq[SegmentRange] = {
    val n = inputSegments.size
    var prevBoundary = 0
    var searchFrom = 0 // assignment is monotone, so each boundary search resumes where the last ended
    inputSegments.zipWithIndex.map { case (seg, k) =>
      val start = prevBoundary
      val end =
        if (k == n - 1) outLen - 1 // last boundary pinned to the final output vertex
        else {
          val j = assignment.indexWhere(_ >= seg.endIdx, searchFrom)
          val candidate = if (j < 0) outLen - 1 else j
          math.max(start, math.min(candidate, outLen - 1))
        }
      prevBoundary = end
      searchFrom = end
      SegmentRange(seg.kind, seg.retrace, start, end)
    }
  }

  /** Default provenance when the caller sends none: one segment spanning everything. */
  def defaultSegments(traceLen: Int): Seq[SegmentRange] =
    Seq(SegmentRange(kind = "shape", retrace = false, startIdx = 0, endIdx = traceLen - 1))

  // ── Error translation ─────────────────────────────────────────────────────────────────

  /**
   * Translate raw GraphHopper failure messages into actionable advice (medium law #5:
   * "solver failures map to move/rotate/rescale advice"). The raw message is kept in
   * parentheses for debugging.
   */
  def actionableError(raw: String): String = {
    val msg = Option(raw).getOrElse("unknown matching error")
    val lower = msg.toLowerCase
    if (lower.contains("sequence is broken") || lower.contains("no candidates") || lower.contains("cannot find matching path"))
      s"trace crosses an unroutable area (water, highway, private land) or leaves the graph — move, rotate, or rescale the placement ($msg)"
    else if (lower.contains("out of bounds") || lower.contains("no close edge") || lower.contains("cannot find point"))
      s"trace outside graph area — move or rescale placement ($msg)"
    else
      msg
  }
}
