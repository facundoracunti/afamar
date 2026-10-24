"""Multi-option (multi-escenario) budgets — Fase 1 runtime layer.

2026-10-01. Covers `app.services.budget_options`:

  * the storage contract (`options_data` is a JSON array of options, each
    owning its own `pieces`),
  * the **legacy fallback** — a budget with no `options_data` resolves to
    ONE synthetic "Opción Única" built from `pieces_data`, so every
    pre-migration budget keeps working with NO backfill,
  * `find_option` / `is_multi_option` used by Phase 2+ (UI tabs, conversion).

These tests also assert the **retrocompat contract** that motivated the
design: the legacy per-piece `alternativeMaterials` model is untouched —
a budget that quotes an alternative material inside a piece still
resolves with that piece intact.
"""
import json

import pytest

from app.services.budget_options import (
    SINGLE_OPTION_ID,
    find_option,
    is_multi_option,
    parse_pieces,
    resolve_budget_options,
    serialize_pieces,
)


# ────────────────────────────────────────────────────────────────────
# Fixtures / helpers
# ────────────────────────────────────────────────────────────────────


def _piece(name: str, length: float = 2, width: float = 1) -> dict:
    return {
        "id": f"p-{name}",
        "name": name,
        "mainMaterial": {
            "id": 1,
            "name": name,
            "price_m2": 100000,
            "price_m2_usd": 0,
            "currency": "ARS",
            "quantity": 1,
            "length": length,
            "width": width,
            "is_alternative": False,
        },
        "alternativeMaterials": [],
        "fabrication_details": [],
        "additional_works_data": "[]",
        "pools": [],
    }


def _option(opt_id: str, name: str, *pieces: dict) -> dict:
    return {
        "id": opt_id,
        "name": name,
        "is_selected": False,
        "pieces": list(pieces),
    }


# ────────────────────────────────────────────────────────────────────
# 1. Legacy fallback — the retrocompat guarantee
# ────────────────────────────────────────────────────────────────────


def test_legacy_budget_without_options_resolves_to_one_synthetic_option():
    pieces = json.dumps([_piece("COCINA"), _piece("BAÑO")])
    options = resolve_budget_options(options_data=None, pieces_data=pieces)

    assert len(options) == 1
    opt = options[0]
    assert opt["id"] == SINGLE_OPTION_ID
    assert opt["name"] == "Opción Única"
    # Legacy budgets answer `is_selected=True` so callers that pick "the
    # selected option" keep working without a special case.
    assert opt["is_selected"] is True
    # Every legacy piece is preserved verbatim, in order.
    assert [p["name"] for p in opt["pieces"]] == ["COCINA", "BAÑO"]


def test_legacy_budget_with_no_pieces_resolves_to_empty_list():
    # A budget with neither options nor pieces has nothing to offer —
    # callers must iterate safely.
    assert resolve_budget_options(None, None) == []
    assert resolve_budget_options(None, "") == []
    assert resolve_budget_options(None, "[]") == []
    assert resolve_budget_options(None, "not-json") == []


def test_legacy_budget_keeps_the_pieces_alternative_materials_untouched():
    # The whole point of the coexistence strategy: the legacy model
    # (alternatives INSIDE a piece) must survive the migration.
    piece = _piece("COCINA")
    piece["alternativeMaterials"] = [{
        "id": 2, "name": "NEGRO BRASIL", "price_m2": 300000, "price_m2_usd": 0,
        "currency": "ARS", "quantity": 1, "length": 2, "width": 1,
        "is_alternative": True,
    }]
    options = resolve_budget_options(None, json.dumps([piece]))

    resolved_alts = options[0]["pieces"][0]["alternativeMaterials"]
    assert len(resolved_alts) == 1
    assert resolved_alts[0]["name"] == "NEGRO BRASIL"


# ────────────────────────────────────────────────────────────────────
# 2. Multi-option storage
# ────────────────────────────────────────────────────────────────────


def test_multi_option_budget_resolves_each_option_with_its_own_pieces():
    raw = json.dumps([
        _option("opt-1", "Opción 1", _piece("COCINA"), _piece("BAÑO")),
        _option("opt-2", "Opción 2", _piece("COCINA", 3, 0.6)),
    ])
    options = resolve_budget_options(options_data=raw, pieces_data=None)

    assert len(options) == 2
    assert options[0]["id"] == "opt-1"
    assert options[0]["name"] == "Opción 1"
    assert [p["name"] for p in options[0]["pieces"]] == ["COCINA", "BAÑO"]
    # The second option is INDEPENDENT — it does not inherit option 1's pieces.
    assert [p["name"] for p in options[1]["pieces"]] == ["COCINA"]
    assert options[1]["pieces"][0]["mainMaterial"]["width"] == 0.6


def test_multi_option_accepts_already_parsed_list():
    # The frontend sends in-memory state (a real list), not a JSON string.
    raw = [_option("opt-1", "Opción 1", _piece("COCINA"))]
    options = resolve_budget_options(options_data=raw, pieces_data=None)
    assert len(options) == 1
    assert options[0]["id"] == "opt-1"


def test_option_without_pieces_is_dropped():
    # An empty option would convert to an empty work order, so it must not
    # be surfaced as a selectable option.
    raw = json.dumps([
        _option("opt-1", "Opción 1", _piece("COCINA")),
        {"id": "opt-2", "name": "Vacía", "pieces": []},
    ])
    options = resolve_budget_options(options_data=raw, pieces_data=None)
    assert [o["id"] for o in options] == ["opt-1"]


def test_corrupt_options_falls_back_to_legacy_instead_of_hiding_the_budget():
    # A malformed option list must not make the budget look empty — the
    # legacy pieces are still the real configuration.
    pieces = json.dumps([_piece("COCINA")])
    for bad in ("not-json", "{broken", 12345):
        options = resolve_budget_options(options_data=bad, pieces_data=pieces)
        assert len(options) == 1
        assert options[0]["id"] == SINGLE_OPTION_ID
        assert options[0]["pieces"][0]["name"] == "COCINA"


def test_options_list_present_but_all_empty_falls_back_to_legacy():
    pieces = json.dumps([_piece("COCINA")])
    options = resolve_budget_options(options_data="[]", pieces_data=pieces)
    assert len(options) == 1
    assert options[0]["id"] == SINGLE_OPTION_ID


def test_option_defaults_are_filled_for_forward_compat():
    # Phase 2 computes subtotal_* and toggles is_selected; Phase 1 must
    # return them with safe defaults so consumers don't need `.get()`.
    raw = json.dumps([{"id": "x", "name": "X", "pieces": [_piece("COCINA")]}])
    option = resolve_budget_options(options_data=raw, pieces_data=None)[0]
    assert option["is_selected"] is False
    assert option["subtotal_ars"] == 0.0
    assert option["subtotal_usd"] == 0.0


def test_option_id_and_name_are_generated_when_missing():
    raw = json.dumps([{"pieces": [_piece("COCINA")]}, {"pieces": [_piece("BAÑO")]}])
    options = resolve_budget_options(options_data=raw, pieces_data=None)
    assert options[0]["id"] == "opt-1"
    assert options[0]["name"] == "Opción 1"
    assert options[1]["id"] == "opt-2"
    assert options[1]["name"] == "Opción 2"


# ────────────────────────────────────────────────────────────────────
# 3. find_option — the Phase 3 conversion entry point
# ────────────────────────────────────────────────────────────────────


def test_find_option_by_id():
    raw = json.dumps([
        _option("opt-1", "Opción 1", _piece("COCINA")),
        _option("opt-2", "Opción 2", _piece("BAÑO")),
    ])
    options = resolve_budget_options(raw, None)
    assert find_option(options, "opt-2")["name"] == "Opción 2"
    assert find_option(options, "opt-1")["name"] == "Opción 1"


def test_find_option_without_id_is_safe():
    single = resolve_budget_options(None, json.dumps([_piece("COCINA")]))
    # Exactly one option → no id needed (legacy path).
    assert find_option(single, None)["id"] == SINGLE_OPTION_ID
    assert find_option(single, "")["id"] == SINGLE_OPTION_ID

    multi_raw = json.dumps([
        _option("opt-1", "Opción 1", _piece("COCINA")),
        _option("opt-2", "Opción 2", _piece("BAÑO")),
    ])
    multi = resolve_budget_options(multi_raw, None)
    # Several options and no id → refuse to guess (converting the wrong
    # option would charge the wrong price / deduct the wrong sink).
    assert find_option(multi, None) is None
    assert find_option(multi, "") is None


def test_find_option_unknown_id_returns_none():
    raw = json.dumps([_option("opt-1", "Opción 1", _piece("COCINA"))])
    options = resolve_budget_options(raw, None)
    assert find_option(options, "opt-99") is None
    assert find_option([], "opt-1") is None


# ────────────────────────────────────────────────────────────────────
# 4. is_multi_option — drives the UI tabs (Phase 2)
# ────────────────────────────────────────────────────────────────────


class _FakeBudget:
    def __init__(self, options_data):
        self.options_data = options_data


def test_is_multi_option_true_only_for_several_stored_options():
    two = json.dumps([
        _option("opt-1", "Opción 1", _piece("COCINA")),
        _option("opt-2", "Opción 2", _piece("BAÑO")),
    ])
    one = json.dumps([_option("opt-1", "Opción 1", _piece("COCINA"))])
    assert is_multi_option(_FakeBudget(two)) is True
    # A single stored option does not need the tabs.
    assert is_multi_option(_FakeBudget(one)) is False


def test_is_multi_option_false_for_legacy_budget():
    # The legacy budget answers False even though resolve_budget_options
    # synthesises one option for it — so the UI does NOT render tabs for
    # budgets that only ever had one configuration.
    legacy = _FakeBudget(None)
    assert is_multi_option(legacy) is False
    assert is_multi_option(_FakeBudget("")) is False
    assert is_multi_option(_FakeBudget("[]")) is False
    assert is_multi_option(_FakeBudget("not-json")) is False
    # …but it still resolves to one addressable option for Phase 3.
    resolved = resolve_budget_options(legacy.options_data, json.dumps([_piece("COCINA")]))
    assert find_option(resolved, SINGLE_OPTION_ID) is not None


# ────────────────────────────────────────────────────────────────────
# 5. pieces parse / serialize round-trip
# ────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("raw", [
    json.dumps([_piece("COCINA")]),
    [_piece("COCINA")],
])
def test_parse_pieces_accepts_string_and_list(raw):
    assert len(parse_pieces(raw)) == 1


def test_parse_pieces_drops_non_dicts_and_degrades_gracefully():
    assert parse_pieces(json.dumps([_piece("COCINA"), "junk", None])) != []
    assert len(parse_pieces(json.dumps([_piece("COCINA"), "junk", None]))) == 1
    assert parse_pieces(json.dumps({"not": "a list"})) == []
    assert parse_pieces(None) == []
    assert parse_pieces(12345) == []


def test_serialize_pieces_returns_none_when_empty():
    # Keeps the NULL/'' semantics that the legacy fallback checks.
    assert serialize_pieces([]) is None
    assert serialize_pieces(None) is None
    assert serialize_pieces([_piece("COCINA")]) is not None
    # Round-trip.
    pieces = [_piece("COCINA")]
    assert parse_pieces(serialize_pieces(pieces))[0]["name"] == "COCINA"