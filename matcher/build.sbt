name := "matcher"
version := "0.1.0"
scalaVersion := "2.13.16"

// Run `sbt run` on 8080 (gateway=3000, python=8000, frontend=5173 are taken).
PlayKeys.playDefaultPort := 8080

lazy val root = (project in file("."))
  .enablePlugins(PlayScala)

libraryDependencies ++= Seq(
  guice,
  // GraphHopper 8.0: stable Profile/MapMatching API (v9+ churned to custom-model profiles).
  // graphhopper-map-matching pulls graphhopper-core + JTS transitively.
  "com.graphhopper" % "graphhopper-map-matching" % "8.0",
  // munit: tiny, zero-magic test framework (sbt ≥ 1.5 auto-detects it). Tests cover ONLY
  // the pure logic in SolveLogic/SolveModels — never the (heavy, minutes-to-load) graph.
  "org.scalameta" %% "munit" % "1.0.0" % Test
)
