"""Server-side export-credit ledger, keyed by opaque license identifier.

The ledger is the single source of truth for how many exports a license may
still make. Credits are granted ONLY when a Stripe Checkout Session settles
(webhook `checkout.session.completed`); the app can never mint them. Export
consumes one credit via `consume`, which is the only decrement path and is
atomic per key.

Backed by a JSON file under `.data/` — the backend's local-first seam, the
server-side mirror of the app's AsyncStorage. A future multi-tenant deploy
swaps this module's body for a Postgres table without touching the router.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Dict

_root = Path(__file__).resolve().parent.parent
_data_dir = _root / ".data"
_ledger_path = _data_dir / "credits.json"
_lock = threading.Lock()


def _load() -> Dict[str, int]:
    if not _ledger_path.exists():
        return {}
    try:
        return json.loads(_ledger_path.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def _save(ledger: Dict[str, int]) -> None:
    _data_dir.mkdir(parents=True, exist_ok=True)
    tmp = _ledger_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(ledger))
    tmp.replace(_ledger_path)


def remaining(license_key: str) -> int:
    """Credits remaining for a key. Unknown keys have zero, not an error."""
    with _lock:
        return _load().get(license_key, 0)


def grant(license_key: str, credits: int) -> int:
    """Add credits to a key (after a settled Stripe payment). New balance."""
    if credits <= 0:
        raise ValueError("credits to grant must be positive")
    with _lock:
        ledger = _load()
        new_balance = ledger.get(license_key, 0) + credits
        ledger[license_key] = new_balance
        _save(ledger)
        return new_balance


def consume(license_key: str) -> tuple[bool, int]:
    """Try to consume one credit. Returns (ok, remaining). Atomic per key."""
    with _lock:
        ledger = _load()
        balance = ledger.get(license_key, 0)
        if balance <= 0:
            return False, 0
        ledger[license_key] = balance - 1
        _save(ledger)
        return True, balance - 1
