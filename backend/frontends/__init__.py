"""Compiler frontends: anything → StrokeSet IR (spec §6.1).

Each module here is a *frontend* in the compiler sense: it accepts one kind
of input (text, a known shape name, a novel concept) and emits the one
shared intermediate representation — ``models.ir.StrokeSet`` in unit space.
Downstream stages (Normalizer, Composer, Projector) never know which
frontend produced the IR.
"""
