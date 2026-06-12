package services

import models.SegmentRange

/**
 * Unit tests for the PURE solve logic — no GraphHopper graph anywhere near these.
 *
 * Geometry cheat-sheet for the synthetic data: 0.001° of latitude ≈ 111 m everywhere;
 * near the equator 0.001° of longitude is also ≈ 111 m. We build traces along the
 * equator so degrees translate to meters in your head.
 */
class SolveLogicSuite extends munit.FunSuite {

  // ── Loop closure ──────────────────────────────────────────────────────────────────────

  test("closeLoop: appends first point when endpoints are farther than the threshold") {
    // ~111 m gap (0.001° lat) — well over the 30 m threshold.
    val trace = Seq((14.42, 50.080), (14.43, 50.082), (14.42, 50.081))
    val closed = SolveLogic.closeLoop(trace, wantLoop = true)
    assertEquals(closed.size, trace.size + 1)
    assertEquals(closed.last, trace.head)
  }

  test("closeLoop: leaves trace alone when endpoints are within the threshold") {
    // 0.0002° lat ≈ 22 m — under the 30 m threshold: already "a loop" within GPS jitter.
    val trace = Seq((14.42, 50.0800), (14.43, 50.0820), (14.42, 50.0802))
    assertEquals(SolveLogic.closeLoop(trace, wantLoop = true), trace)
  }

  test("closeLoop: exact first==last is never re-appended") {
    val trace = Seq((14.42, 50.08), (14.43, 50.09), (14.42, 50.08))
    assertEquals(SolveLogic.closeLoop(trace, wantLoop = true), trace)
  }

  test("closeLoop: no-op when closeLoop is false, regardless of gap") {
    val trace = Seq((14.42, 50.08), (14.43, 50.20))
    assertEquals(SolveLogic.closeLoop(trace, wantLoop = false), trace)
  }

  test("haversineMeters: sanity — 0.001° latitude is ~111 m") {
    val d = SolveLogic.haversineMeters((14.42, 50.080), (14.42, 50.081))
    assert(d > 100 && d < 120, s"expected ~111 m, got $d")
  }

  // ── Monotonic provenance sweep ────────────────────────────────────────────────────────

  /** Input: 5 points marching east along the equator, one every 0.001°. */
  private val input: Seq[(Double, Double)] =
    (0 to 4).map(i => (i * 0.001, 0.0))

  /** Output: the same line densified 4×, one point every 0.00025°. */
  private val denseOutput: Seq[(Double, Double)] =
    (0 to 16).map(j => (j * 0.00025, 0.0))

  test("assignOutputsToInputs: assignment is monotonically non-decreasing") {
    val assign = SolveLogic.assignOutputsToInputs(input, denseOutput)
    assertEquals(assign.size, denseOutput.size)
    assign.sliding(2).foreach {
      case Seq(a, b) => assert(a <= b, s"assignment went backward: $a -> $b")
      case _         => ()
    }
    // Endpoints land on endpoints.
    assertEquals(assign.head, 0)
    assertEquals(assign.last, input.size - 1)
  }

  test("assignOutputsToInputs: never jumps ahead across an exact retrace") {
    // A -> B -> A : the trace walks out and back over identical geometry. The strictly-
    // closer rule must keep early output points assigned to the FIRST pass (index 0),
    // not leap to the duplicate at index 2.
    val retraceIn  = Seq((0.0, 0.0), (0.001, 0.0), (0.0, 0.0))
    val retraceOut = Seq((0.0, 0.0), (0.0005, 0.0), (0.001, 0.0), (0.0005, 0.0), (0.0, 0.0))
    val assign = SolveLogic.assignOutputsToInputs(retraceIn, retraceOut)
    assertEquals(assign, Vector(0, 0, 1, 1, 2))
  }

  test("mapSegments: output ranges tile exactly (the frontend invariant)") {
    val segments = Seq(
      SegmentRange("glyph",     retrace = false, startIdx = 0, endIdx = 2),
      SegmentRange("connector", retrace = true,  startIdx = 2, endIdx = 4)
    )
    val assign = SolveLogic.assignOutputsToInputs(input, denseOutput)
    val out = SolveLogic.mapSegments(segments, assign, denseOutput.size)

    assertEquals(out.size, 2)
    // Tiling invariant: starts at 0, ends at last output index, shared boundaries.
    assertEquals(out.head.startIdx, 0)
    assertEquals(out.last.endIdx, denseOutput.size - 1)
    out.sliding(2).foreach {
      case Seq(a, b) => assertEquals(a.endIdx, b.startIdx)
      case _         => ()
    }
    // Kind/retrace provenance is preserved verbatim.
    assertEquals(out.map(_.kind), Seq("glyph", "connector"))
    assertEquals(out.map(_.retrace), Seq(false, true))
    // Input boundary vertex 2 sits at 0.002°. Output index 7 (0.00175°) is the FIRST
    // output point strictly closer to input vertex 2 than to vertex 1, so the
    // nearest-vertex sweep places the boundary there — deterministically.
    assertEquals(out.head.endIdx, 7)
  }

  test("mapSegments: boundaries never move backward even on degenerate assignments") {
    // All outputs assigned to input 0 (e.g. matcher collapsed the line): interior
    // boundaries clamp forward, the last segment absorbs everything, tiling still holds.
    val segments = Seq(
      SegmentRange("glyph",     retrace = false, startIdx = 0, endIdx = 2),
      SegmentRange("connector", retrace = false, startIdx = 2, endIdx = 4)
    )
    val out = SolveLogic.mapSegments(segments, Vector(0, 0, 0, 0), outLen = 4)
    assertEquals(out.head, SegmentRange("glyph", retrace = false, startIdx = 0, endIdx = 3))
    assertEquals(out.last, SegmentRange("connector", retrace = false, startIdx = 3, endIdx = 3))
  }

  test("defaultSegments: single 'shape' segment spanning the whole trace") {
    assertEquals(
      SolveLogic.defaultSegments(42),
      Seq(SegmentRange("shape", retrace = false, startIdx = 0, endIdx = 41))
    )
  }

  // ── Validation ────────────────────────────────────────────────────────────────────────

  test("validateTrace: rejects empty and single-point traces with actionable text") {
    assert(SolveLogic.validateTrace(Seq.empty).isLeft)
    val short = SolveLogic.validateTrace(Seq(Seq(14.42, 50.08)))
    assert(short.isLeft)
    assert(short.swap.exists(_.contains("at least 2")))
  }

  test("validateTrace: rejects out-of-range coordinates and hints at lng/lat order") {
    // 200° longitude is impossible; 95° latitude smells like swapped lng/lat.
    val badLng = SolveLogic.validateTrace(Seq(Seq(200.0, 50.0), Seq(14.42, 50.08)))
    assert(badLng.isLeft)
    assert(badLng.swap.exists(_.contains("out of range")))

    val badLat = SolveLogic.validateTrace(Seq(Seq(14.42, 95.0), Seq(14.43, 50.08)))
    assert(badLat.isLeft)
  }

  test("validateTrace: rejects non-pair points") {
    assert(SolveLogic.validateTrace(Seq(Seq(14.42, 50.08, 7.0), Seq(14.43, 50.09))).isLeft)
  }

  test("validateTrace: accepts a well-formed trace and returns (lng, lat) tuples") {
    val ok = SolveLogic.validateTrace(Seq(Seq(14.42, 50.08), Seq(14.43, 50.09)))
    assertEquals(ok, Right(Seq((14.42, 50.08), (14.43, 50.09))))
  }

  test("validateSegments: accepts an exact tiling") {
    val segs = Seq(
      SegmentRange("glyph",     retrace = false, 0, 41),
      SegmentRange("connector", retrace = true, 41, 48)
    )
    assertEquals(SolveLogic.validateSegments(segs, traceLen = 49), None)
  }

  test("validateSegments: rejects gaps, wrong endpoints, and empty ranges") {
    // Gap between 40 and 41.
    val gap = Seq(SegmentRange("a", retrace = false, 0, 40), SegmentRange("b", retrace = false, 41, 48))
    assert(SolveLogic.validateSegments(gap, 49).isDefined)
    // Doesn't start at 0.
    val late = Seq(SegmentRange("a", retrace = false, 1, 48))
    assert(SolveLogic.validateSegments(late, 49).isDefined)
    // Doesn't end at traceLen-1.
    val shortEnd = Seq(SegmentRange("a", retrace = false, 0, 47))
    assert(SolveLogic.validateSegments(shortEnd, 49).isDefined)
    // Empty range.
    val empty = Seq(SegmentRange("a", retrace = false, 0, 0), SegmentRange("b", retrace = false, 0, 48))
    assert(SolveLogic.validateSegments(empty, 49).isDefined)
  }

  // ── Error translation ─────────────────────────────────────────────────────────────────

  test("actionableError: maps known GraphHopper failures to placement advice") {
    val broken = SolveLogic.actionableError("Sequence is broken for submitted track at time step 3")
    assert(broken.contains("move, rotate, or rescale"))
    val outside = SolveLogic.actionableError("Point 12 is out of bounds: 0.0,0.0")
    assert(outside.contains("trace outside graph area"))
    // Unknown messages pass through untouched.
    assertEquals(SolveLogic.actionableError("boom"), "boom")
  }
}
