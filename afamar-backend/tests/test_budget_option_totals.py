"""Per-option totals for multi-option budgets (2026-10-01, Fase 2).

Covers `app.services.budget_option_totals`:

  * each option is priced from ITS OWN pieces — no cross-option leakage
    (the core promise of "Opciones / Escenarios Independientes"),
  * each option is billed with ITS OWN pieces' piletas,
  * a legacy budget (no `options_data`) reports exactly ONE row, so the
    PDF/API needs no branch,
  * `pick_winning_option` refuses to guess when the choice is ambiguous.
"""
import json

from app.services.budget_option_totals import (
    compute_option_subtotals,
    compute_options_report,
    pick_winning_option,
)
from app.services.budget_options import SINGLE_OPTION_ID
from app.services.budget_option_totals import winning_option_flat


def _main(name: str, price_m2: float, length: float = 2, width: float = 1, currency: str = "ARS") -> dict:
    return {
        "id": 1,
        "name": name,
        "price_m2": price_m2,
        "price_m2_usd": price_m2 / 1000 if currency == "USD" else 0,
        "currency": currency,
        "quantity": 1,
        "length": length,
        "width": width,
        "is_alternative": False,
    }


def _piece(pid: str, name: str, main: dict, **overrides) -> dict:
    piece = {
        "id": pid,
        "name": name,
        "mainMaterial": main,
        "mainMaterialRows": [],
        "alternativeMaterials": [],
        "fabrication_details": [],
        "additional_works_data": "[]",
        "pools": [],
    }
    piece.update(overrides)
    return piece


def _option(opt_id: str, name: str, *pieces: dict, is_selected: bool = False) -> dict:
    return {
        "id": opt_id,
        "name": name,
        "is_selected": is_selected,
        "pieces": list(pieces),
    }


# ────────────────────────────────────────────────────────────────────
# 1. Isolation — each option priced from its own pieces only
# ────────────────────────────────────────────────────────────────────


def test_options_are_priced_independently():
    # Opción 1: CALACATTA 100.000/m² × 2 m² = 200.000
    # Opción 2: NEGRO BRASIL 300.000/m² × 2 m² = 600.000
    # If options leaked, both would report the same number.
    raw = json.dumps([
        _option("opt-1", "Opción 1", _piece("p1", "COCINA", _main("CALACATTA", 100000))),
        _option("opt-2", "Opción 2", _piece("p2", "COCINA", _main("NEGRO BRASIL", 300000))),
    ])

    report = compute_options_report(raw, None, usd_rate=1000)
    assert len(report) == 2
    assert report[0]["subtotal_ars"] == 200000.0
    assert report[1]["subtotal_ars"] == 600000.0


def test_multiple_pieces_sum_only_within_their_own_option():
    # Opción 1 has COCINA + BAÑO; Opción 2 has only PARRILLA.
    raw = json.dumps([
        _option(
            "opt-1", "Opción 1",
            _piece("p1", "COCINA", _main("CALACATTA", 100000)),   # 200.000
            _piece("p2", "BAÑO", _main("BLANCO", 50_000)),        # 100.000
        ),
        _option("opt-2", "Opción 2", _piece("p3", "PARRILLA", _main("NEGRO", 150_000))),
    ])

    report = compute_options_report(raw, None, usd_rate=1000)
    assert report[0]["subtotal_ars"] == 300000.0          # COCINA + BAÑO
    assert report[0]["piece_names"] == ["COCINA", "BAÑO"]
    assert report[1]["subtotal_ars"] == 300000.0          # PARRILLA alone
    assert report[1]["piece_names"] == ["PARRILLA"]


def test_alternative_materials_do_not_bill_the_option_subtotal():
    # Alternatives are quoted separately (HOJA DE ALTERNATIVAS), so the
    # option subtotal bills only the main material — same rule as
    # `filter_main_materials` document-wide.
    piece = _piece("p1", "COCINA", _main("CALACATTA", 100000))
    piece["alternativeMaterials"] = [{
        "id": 2, "name": "NEGRO BRASIL", "price_m2": 999_000, "price_m2_usd": 0,
        "currency": "ARS", "quantity": 1, "length": 2, "width": 1,
        "is_alternative": True,
    }]
    subtotals = compute_option_subtotals(_option("opt-1", "Opción 1", piece), 1000)
    assert subtotals["subtotal_ars"] == 200000.0


def test_components_are_reported_separately():
    piece = _piece("p1", "COCINA", _main("CALACATTA", 100000))
    piece["fabrication_details"] = [{
        "concept": "BASEBOARD", "material": "CALACATTA",
        "length": 1, "width": 0.1, "quantity": 1, "price": 30_000,
        "currency": "ARS",
    }]
    piece["pools"] = [{
        "pool_id": 1, "brand": "JOHNSON", "model": "Q 76 A",
        "price": 850_000, "currency": "ARS", "quantity": 1,
    }]

    report = compute_options_report(
        json.dumps([_option("opt-1", "Opción 1", piece)]), None, usd_rate=1000,
    )
    comp = report[0]["components"]
    assert comp["materials_ars"] == 200000.0        # 2 m² × 100.000
    assert comp["fabrication_ars"] == 30_000.0       # 1 zócalo
    assert comp["pools_ars"] == 850_000.0           # 1 pileta
    assert comp["additional_ars"] == 0.0
    assert report[0]["subtotal_ars"] == 1_080_000.0


# ────────────────────────────────────────────────────────────────────
# 1b. Key-spelling tolerance (2026-10-01 live-test bugfix)
# ────────────────────────────────────────────────────────────────────


def test_fabrication_rows_are_priced_with_the_english_keys():
    # The pieces flow sends `price` / `quantity` / `currency`; the legacy
    # rows use `precio` / `cantidad` / `moneda`. Reading only one spelling
    # priced the zócalo at $0 — the option then showed ONLY its traforos
    # while the operator saw the zócalo priced in the form.
    piece = _piece("p1", "COCINA", _main("CALACATTA", 100000))
    piece["fabrication_details"] = [{
        "concept": "BASEBOARD", "material": "CALACATTA",
        "length": 1, "width": 0.1, "quantity": 1, "price": 30_000,
        "currency": "ARS",
    }]
    subtotals = compute_option_subtotals(_option("opt-1", "Opción 1", piece), 1000)
    assert subtotals["fabrication_ars"] == 30_000.0
    assert subtotals["subtotal_ars"] == 230_000.0


def test_fabrication_rows_are_priced_with_the_legacy_spanish_keys():
    piece = _piece("p1", "COCINA", _main("CALACATTA", 100000))
    piece["fabrication_details"] = [{
        "concept": "BASEBOARD", "material": "CALACATTA",
        "length": 1, "width": 0.1, "cantidad": 1, "precio": 30_000,
        "moneda": "ARS",
    }]
    subtotals = compute_option_subtotals(_option("opt-1", "Opción 1", piece), 1000)
    assert subtotals["fabrication_ars"] == 30_000.0


def test_additional_works_are_priced_with_the_legacy_spanish_keys():
    piece = _piece("p1", "COCINA", _main("CALACATTA", 100000))
    piece["additional_works_data"] = json.dumps([
        {"name": "Traforo", "precio": 60_000, "cantidad": 1, "moneda": "ARS"},
    ])
    subtotals = compute_option_subtotals(_option("opt-1", "Opción 1", piece), 1000)
    assert subtotals["additional_ars"] == 60_000.0
    assert subtotals["subtotal_ars"] == 260_000.0


def test_option_keeps_the_extra_panes_when_the_principal_row_is_missing():
    # `flatten_pieces` (document-level) collects the panes independently of
    # the anchor row; the option flattener must do the same, otherwise the
    # option priced at $0 while the document's flat arrays kept the
    # material's amount.
    piece = _piece("p1", "COCINA", _main("CALACATTA", 100000))
    piece["mainMaterial"] = None
    piece["mainMaterialRows"] = [_main("CALACATTA", 100000)]
    subtotals = compute_option_subtotals(_option("opt-1", "Opción 1", piece), 1000)
    assert subtotals["materials_ars"] == 200_000.0
    assert subtotals["subtotal_ars"] == 200_000.0


# ────────────────────────────────────────────────────────────────────
# 1c. Legacy PDF alignment (2026-10-01)
# ────────────────────────────────────────────────────────────────────


def test_winning_option_flat_returns_the_winners_arrays():
    # The document-level flat arrays hold whichever option the form had
    # OPEN when the budget was saved. The client-facing download must
    # describe the WINNER, so the legacy PDF re-derives them.
    opt1 = _option("opt-1", "Opción 1", _piece("p1", "COCINA", _main("NEGRO BRASIL", 300000)))
    opt2 = _option("opt-2", "Opción 2", _piece("p2", "COCINA", _main("BLANCO ZEN MATE", 150000)))
    opt2["is_selected"] = True

    flat = winning_option_flat({
        "options_data": json.dumps([opt1, opt2]),
        # The saved (active) option was the FIRST one — the PDF must not
        # print it.
        "pieces_data": json.dumps([opt1["pieces"][0]]),
        "materials_data": json.dumps([_main("NEGRO BRASIL", 300000)]),
    })
    assert flat is not None
    assert [m["name"] for m in flat["materials"]] == ["BLANCO ZEN MATE"]


def test_winning_option_flat_is_none_for_a_legacy_budget():
    assert winning_option_flat({"pieces_data": json.dumps([
        _piece("p1", "COCINA", _main("CALACATTA", 100000)),
    ])}) is None


def test_legacy_budget_pdf_describes_the_winning_option():
    # End-to-end on the legacy (xhtml2pdf) builder: the materials printed
    # to the client are the winner's, not the active one's.
    from app.services.pdf_html import build_budget_pdf_data

    opt1 = _option("opt-1", "Opción 1", _piece("p1", "COCINA", _main("NEGRO BRASIL", 300000)))
    opt2 = _option("opt-2", "Opción 2", _piece("p2", "COCINA", _main("BLANCO ZEN MATE", 150000)))
    opt2["is_selected"] = True

    data = build_budget_pdf_data(
        {
            "number": "P-000001",
            "options_data": json.dumps([opt1, opt2]),
            "pieces_data": json.dumps([opt1["pieces"][0]]),
            "materials_data": json.dumps([_main("NEGRO BRASIL", 300000)]),
            "fabrication_details": "[]",
            "additional_works_data": "[]",
            "pools_data": "[]",
            "subtotal": 600000,
            "total": 600000,
            "usd_rate": 1000,
        },
        {"name": "JUAN", "phone": "351", "address": "", "email": ""},
        {"company_name": "AFAMAR"},
        {"budget_terms": [], "delivery_terms": [], "warranty_text": []},
    )
    names = [m["name"] for m in data["materials"]]
    assert "BLANCO ZEN MATE" in names
    assert "NEGRO BRASIL" not in names


# ────────────────────────────────────────────────────────────────────
# 2. Legacy fallback
# ────────────────────────────────────────────────────────────────────

def test_legacy_budget_reports_exactly_one_option():
    pieces = json.dumps([
        _piece("p1", "COCINA", _main("CALACATTA", 100000)),
        _piece("p2", "BAÑO", _main("BLANCO", 50_000)),
    ])
    report = compute_options_report(None, pieces, usd_rate=1000)
    assert len(report) == 1
    assert report[0]["id"] == SINGLE_OPTION_ID
    assert report[0]["name"] == "Opción Única"
    assert report[0]["is_selected"] is True
    assert report[0]["piece_names"] == ["COCINA", "BAÑO"]
    assert report[0]["subtotal_ars"] == 300000.0


def test_empty_budget_reports_no_options():
    assert compute_options_report(None, None, 1000) == []


# ────────────────────────────────────────────────────────────────────
# 3. The option bills the piece's OWN piletas (the per-variant sink
#    override was removed on 2026-10-23).
# ────────────────────────────────────────────────────────────────────


def test_option_bills_the_pieces_own_piletas():
    # Piece's own pileta: 936.000 ARS. The option subtotal bills the MAIN
    # material + that pileta; an ALTERNATIVE's own sink is quoted on the
    # alternatives sheet, never inside the option's subtotal.
    piece = _piece("p1", "COCINA", _main("CALACATTA", 100000))
    piece["pools"] = [{
        "pool_id": 1, "brand": "JOHNSON", "model": "SIGNATURE ENKEL",
        "price": 936_000, "currency": "ARS", "quantity": 1,
    }]
    piece["alternativeMaterials"] = [{
        "id": 2, "name": "NEGRO BRASIL", "price_m2": 300_000, "price_m2_usd": 0,
        "currency": "ARS", "quantity": 1, "length": 2, "width": 1,
        "is_alternative": True,
    }]

    subtotals = compute_option_subtotals(_option("opt-1", "Opción 1", piece), 1000)
    # Main material 200.000 + piece pileta 936.000.
    assert subtotals["subtotal_ars"] == 1_136_000.0
    assert subtotals["pools_ars"] == 936_000.0


def test_option_without_piletas_has_no_pool_component():
    piece = _piece("p1", "COCINA", _main("CALACATTA", 100000))
    subtotals = compute_option_subtotals(_option("opt-1", "Opción 1", piece), 1000)
    assert subtotals["subtotal_ars"] == 200_000.0
    assert subtotals["pools_ars"] == 0.0

# ────────────────────────────────────────────────────────────────────
# 4. pick_winning_option — the Phase 3 conversion guard
# ────────────────────────────────────────────────────────────────────


def test_pick_winning_option_explicit_id():
    raw = json.dumps([
        _option("opt-1", "Opción 1", _piece("p1", "COCINA", _main("A", 100000))),
        _option("opt-2", "Opción 2", _piece("p2", "COCINA", _main("B", 200000))),
    ])
    assert pick_winning_option(raw, None, "opt-2")["id"] == "opt-2"


def test_pick_winning_option_uses_is_selected_marker():
    raw = json.dumps([
        _option("opt-1", "Opción 1", _piece("p1", "COCINA", _main("A", 100000))),
        _option("opt-2", "Opción 2", _piece("p2", "COCINA", _main("B", 200000)), is_selected=True),
    ])
    assert pick_winning_option(raw, None)["id"] == "opt-2"


def test_pick_winning_option_refuses_to_guess_when_ambiguous():
    # Two options, none marked selected, no id → refuse. Converting the
    # wrong option would bill the wrong price AND deduct the wrong sink.
    raw = json.dumps([
        _option("opt-1", "Opción 1", _piece("p1", "COCINA", _main("A", 100000))),
        _option("opt-2", "Opción 2", _piece("p2", "COCINA", _main("B", 200000))),
    ])
    assert pick_winning_option(raw, None) is None


def test_pick_winning_option_legacy_needs_no_id():
    pieces = json.dumps([_piece("p1", "COCINA", _main("CALACATTA", 100000))])
    winner = pick_winning_option(None, pieces)
    assert winner is not None
    assert winner["id"] == SINGLE_OPTION_ID


def test_pick_winning_option_single_stored_option_needs_no_id():
    raw = json.dumps([_option("opt-1", "Opción 1", _piece("p1", "COCINA", _main("A", 100000)))])
    assert pick_winning_option(raw, None)["id"] == "opt-1"


def test_pick_winning_option_two_selected_is_ambiguous():
    raw = json.dumps([
        _option("opt-1", "Opción 1", _piece("p1", "C", _main("A", 1)), is_selected=True),
        _option("opt-2", "Opción 2", _piece("p2", "C", _main("B", 2)), is_selected=True),
    ])
    assert pick_winning_option(raw, None) is None


def test_pick_winning_option_empty_budget():
    assert pick_winning_option(None, None) is None
    assert pick_winning_option("[]", None) is None


def test_pick_winning_option_unknown_id_returns_none():
    raw = json.dumps([
        _option("opt-1", "Opción 1", _piece("p1", "C", _main("A", 1))),
        _option("opt-2", "Opción 2", _piece("p2", "C", _main("B", 2))),
    ])
    assert pick_winning_option(raw, None, "opt-99") is None
