"""Export-credit ledger: the server-side truth behind the loss function.

The app can never mint credits — only the webhook grants them, and only
`consume` decrements. These tests lock that contract: unknown keys are zero,
grants add, consumes decrement atomically, and a zero balance can never go
negative (the export gate's guarantee).
"""

import pytest

from services.credits import consume, grant, remaining


@pytest.fixture(autouse=True)
def _isolated_ledger(tmp_path, monkeypatch):
    """Point the ledger at a temp file so tests never share state."""
    import services.credits as credits_mod

    monkeypatch.setattr(credits_mod, "_ledger_path", tmp_path / "credits.json")
    yield


def test_unknown_key_has_zero_balance():
    assert remaining("no-such-key") == 0


def test_grant_creates_balance():
    assert grant("key-a", 5) == 5
    assert remaining("key-a") == 5


def test_consume_decrements_and_reports_remaining():
    grant("key-b", 5)
    ok, left = consume("key-b")
    assert ok is True
    assert left == 4
    assert remaining("key-b") == 4


def test_consume_at_zero_fails_and_preserves_zero():
    """The export gate guarantee: you cannot spend what you don't have."""
    ok, left = consume("key-empty")
    assert ok is False
    assert left == 0
    assert remaining("key-empty") == 0


def test_consume_never_goes_negative():
    grant("key-one", 1)
    ok1, _ = consume("key-one")
    ok2, left2 = consume("key-one")
    assert ok1 is True
    assert ok2 is False
    assert left2 == 0
    assert remaining("key-one") == 0


def test_double_grant_accumulates():
    grant("key-c", 5)
    assert grant("key-c", 3) == 8
    assert remaining("key-c") == 8


def test_keys_are_independent():
    grant("key-d", 5)
    grant("key-e", 1)
    consume("key-d")
    assert remaining("key-d") == 4
    assert remaining("key-e") == 1


def test_grant_of_non_positive_raises():
    with pytest.raises(ValueError):
        grant("key-f", 0)
    with pytest.raises(ValueError):
        grant("key-f", -3)
