"""Generation eval harness — deterministic, offline per-stage benchmark.

This package measures where the shape-generation pipeline fails (extraction,
snapping, or runnability) so improvements gate on empirical numbers rather than
retries. It runs against recorded routing responses (no network) and is the
truth-source that every later change in `make-routes-reliable-and-runnable`
must beat.
"""
