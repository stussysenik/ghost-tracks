"""Tests for the neighborhood service."""

from services.neighborhood import NeighborhoodService


def test_all_neighborhoods_loaded():
    svc = NeighborhoodService()
    hoods = svc.get_all()
    assert len(hoods) == 12


def test_all_neighborhoods_have_valid_centers():
    """All neighborhood centers must be within Prague bounds."""
    svc = NeighborhoodService()
    for hood in svc.get_all():
        assert 14.22 < hood.center.lng < 14.71, f"{hood.name} lng out of Prague"
        assert 49.94 < hood.center.lat < 50.18, f"{hood.name} lat out of Prague"


def test_all_neighborhoods_have_valid_bbox():
    svc = NeighborhoodService()
    for hood in svc.get_all():
        assert hood.bbox.min_lng < hood.bbox.max_lng, f"{hood.name} invalid lng range"
        assert hood.bbox.min_lat < hood.bbox.max_lat, f"{hood.name} invalid lat range"


def test_get_by_name_exact():
    svc = NeighborhoodService()
    hood = svc.get_by_name("Vinohrady")
    assert hood is not None
    assert hood.name == "Vinohrady"


def test_get_by_name_with_diacritics():
    svc = NeighborhoodService()
    hood = svc.get_by_name("Žižkov")
    assert hood is not None
    assert hood.name == "Žižkov"


def test_get_by_name_without_diacritics():
    svc = NeighborhoodService()
    hood = svc.get_by_name("Zizkov")
    assert hood is not None
    assert hood.name == "Žižkov"


def test_get_by_name_case_insensitive():
    svc = NeighborhoodService()
    hood = svc.get_by_name("vinohrady")
    assert hood is not None
    assert hood.name == "Vinohrady"


def test_get_by_name_unknown():
    svc = NeighborhoodService()
    assert svc.get_by_name("NonExistent") is None


def test_find_best_for_geometric_shape():
    svc = NeighborhoodService()
    results = svc.find_best_for_shape("geometric", 5.0)
    assert len(results) > 0
    # Grid neighborhoods should rank higher for geometric shapes
    top_names = [r.name for r in results[:3]]
    grid_hoods = {"Vinohrady", "Karlín", "Holešovice", "Vršovice"}
    assert any(n in grid_hoods for n in top_names)


def test_find_best_for_creature():
    svc = NeighborhoodService()
    results = svc.find_best_for_shape("creature", 5.0)
    assert len(results) > 0


def test_summary_string_includes_all():
    svc = NeighborhoodService()
    summary = svc.get_summary_string()
    for hood in svc.get_all():
        assert hood.name in summary


def test_all_neighborhoods_have_street_layout():
    svc = NeighborhoodService()
    for hood in svc.get_all():
        assert hood.street_layout in ("grid", "organic", "mixed")


def test_all_neighborhoods_have_good_for():
    svc = NeighborhoodService()
    for hood in svc.get_all():
        assert len(hood.good_for) > 0
