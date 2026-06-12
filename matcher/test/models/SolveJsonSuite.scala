package models

import play.api.libs.json._

/**
 * JSON contract tests for `/solve` — pure (de)serialization, no Play app, no graph.
 *
 * The headline property is DETERMINISM: the MVP acceptance criterion is
 * "same input ⇒ identical route", and at the wire level that means the same request must
 * serialize to byte-identical response JSON. Play JSON makes this hold structurally
 * (macro Writes emit fields in case-class declaration order; JsObject preserves insertion
 * order; no timestamps or randomness anywhere) — these tests pin that behavior down so a
 * library upgrade or model edit can't silently break it.
 */
class SolveJsonSuite extends munit.FunSuite {

  private val requestJson =
    """{
      |  "trace": [[14.42, 50.08], [14.43, 50.09], [14.44, 50.08]],
      |  "profile": "foot",
      |  "closeLoop": true,
      |  "segments": [
      |    {"kind": "glyph", "retrace": false, "startIdx": 0, "endIdx": 1},
      |    {"kind": "connector", "retrace": true, "startIdx": 1, "endIdx": 2}
      |  ]
      |}""".stripMargin

  test("SolveRequest: parses the full documented request shape") {
    val req = Json.parse(requestJson).as[SolveRequest]
    assertEquals(req.trace.size, 3)
    assertEquals(req.profile, Some("foot"))
    assertEquals(req.closeLoop, Some(true))
    assertEquals(req.segments.map(_.size), Some(2))
    assertEquals(req.segments.get.head, SegmentRange("glyph", retrace = false, 0, 1))
  }

  test("SolveRequest: optional fields default to None when omitted") {
    val req = Json.parse("""{"trace": [[14.42, 50.08], [14.43, 50.09]]}""").as[SolveRequest]
    assertEquals(req.profile, None)
    assertEquals(req.closeLoop, None)
    assertEquals(req.segments, None)
  }

  test("SolveRequest: parsing the same body twice yields equal values (case-class equality)") {
    assertEquals(Json.parse(requestJson).as[SolveRequest], Json.parse(requestJson).as[SolveRequest])
  }

  private def sampleResponse(): SolveResponse =
    SolveResponse(
      coordinates      = Seq(Seq(14.42, 50.08), Seq(14.425, 50.085), Seq(14.43, 50.09)),
      segments         = Seq(
        SegmentRange("glyph", retrace = false, 0, 1),
        SegmentRange("connector", retrace = true, 1, 2)
      ),
      distance_km      = 8.2,
      duration_minutes = 95.0,
      success          = true,
      error            = None
    )

  test("SolveResponse: independently built equal responses serialize byte-identically") {
    val a = Json.stringify(Json.toJson(sampleResponse()))
    val b = Json.stringify(Json.toJson(sampleResponse()))
    assertEquals(a, b)
  }

  test("SolveResponse: field order is fixed by the case class — the wire contract") {
    val fields = Json.toJson(sampleResponse()).as[JsObject].fields.map(_._1)
    assertEquals(
      fields.toList,
      List("coordinates", "segments", "distance_km", "duration_minutes", "success", "error")
    )
    val segFields = (Json.toJson(sampleResponse()) \ "segments" \ 0).as[JsObject].fields.map(_._1)
    assertEquals(segFields.toList, List("kind", "retrace", "startIdx", "endIdx"))
  }

  test("SolveResponse: error None serializes as explicit null (WritesNull config)") {
    val js = Json.stringify(Json.toJson(sampleResponse()))
    assert(js.contains("\"error\":null"), s"expected explicit error:null in $js")
  }

  test("SolveResponse: full request→response cycle is deterministic end-to-end") {
    // Simulate the controller's data path twice from the same raw bytes (validation +
    // defaulting are pure), then compare serialized output byte-for-byte.
    def cycle(): String = {
      val req = Json.parse(requestJson).as[SolveRequest]
      val resp = SolveResponse(
        coordinates      = req.trace,
        segments         = req.segments.get,
        distance_km      = 1.234,
        duration_minutes = 14.8,
        success          = true,
        error            = None
      )
      Json.stringify(Json.toJson(resp))
    }
    assertEquals(cycle(), cycle())
  }

  test("SolveResponse.failure: keeps the same six-field shape with success=false") {
    val js = Json.toJson(SolveResponse.failure("trace outside graph area — move or rescale placement"))
    assertEquals((js \ "success").as[Boolean], false)
    assertEquals((js \ "coordinates").as[Seq[Seq[Double]]], Seq.empty[Seq[Double]])
    assertEquals((js \ "segments").as[Seq[SegmentRange]], Seq.empty[SegmentRange])
    assert((js \ "error").as[String].contains("move or rescale"))
  }
}
