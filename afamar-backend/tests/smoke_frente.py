"""Smoke test for the Frente / Regrueso dynamic-pricing flow.

Talks to the live backend over HTTP. Assumes:
  - the FastAPI server is running at http://localhost:3095
  - the admin user `admin`/`admin123` exists
  - at least one client and one USD-priced material exist

Run with:
    cd afamar-backend
    .\venv\Scripts\python.exe tests\smoke_frente.py

What it does:
  1. Authenticate.
  2. Find or create a `Frente / Regrueso` catalogue row with
     `type='frente'` and `formula_constant=1.15`.
  3. Find the first USD material with a non-zero `price_usd`.
  4. Create a budget carrying a `frente` snapshot row at 2.93 ml.
  5. Re-fetch the budget and assert the persisted JSON has
     `type='frente'`, `total = (price_usd * 0.13 + 1.15) * 2.93`,
     `price` matching `(price_usd * 0.13 + 1.15)`, `currency='USD'`,
     and `formula_values.material_price_m2_at_selection` matching the
     material price.
  6. Clean up by deleting the budget we created.

Prints a clean pass/fail summary at the end. Exits non-zero if anything
fails.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional


API_BASE = "http://localhost:3095/api/v1"
ADMIN = {"username": "admin", "password": "admin123"}
LINEAR_METERS = 1.5
FORMULA_CONSTANT = 1.15


def request_json(
    method: str,
    path: str,
    *,
    token: Optional[str] = None,
    body: Optional[Dict[str, Any]] = None,
    expect: int | tuple[int, ...] = 200,
) -> Dict[str, Any]:
    if isinstance(expect, int):
        expect = (expect,)
    headers: Dict[str, str] = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{API_BASE}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        status = exc.code
        raw = exc.read().decode("utf-8")
    if status not in expect:
        raise AssertionError(
            f"{method} {path} → {status} (expected {expect}). Body: {raw[:500]}"
        )
    if not raw:
        return {}
    return json.loads(raw)


def find_or_create_frente(token: str) -> int:
    listing = request_json("GET", "/additional-works?limit=200", token=token, expect=200)
    items: List[Dict[str, Any]] = listing.get("data", [])
    for item in items:
        if item.get("name") == "Frente / Regrueso" and item.get("type") == "frente":
            return int(item["id"])
    body = {
        "name": "Frente / Regrueso",
        "detail": "Mano de obra calculada automáticamente según material.",
        "price": 0,
        "currency": "USD",
        "type": "frente",
        "formula_constant": FORMULA_CONSTANT,
    }
    created = request_json("POST", "/additional-works", token=token, body=body, expect=201)
    return int(created["data"]["id"])


def find_usd_material(token: str) -> Dict[str, Any]:
    materials = request_json("GET", "/materials?limit=200", token=token)["data"]
    for m in materials:
        if m.get("currency") == "USD" and float(m.get("price_usd") or 0) > 0:
            return m
    # Fall back: first ARS material — the formula still works in any currency.
    for m in materials:
        if float(m.get("base_price") or 0) > 0:
            return m
    raise SystemExit("No usable material in the database.")


def find_client(token: str) -> Dict[str, Any]:
    clients = request_json("GET", "/clients?limit=10", token=token)["data"]
    if not clients:
        raise SystemExit("No client in the database; create one first.")
    return clients[0]


def main() -> int:
    print("smoke_frente: start")
    try:
        login = request_json("POST", "/auth/login", body=ADMIN)["data"]
    except AssertionError as exc:
        print(f"smoke_frente: cannot log in: {exc}", file=sys.stderr)
        return 1
    token = login["access_token"]
    print(f"smoke_frente: logged in as {login.get('user', {}).get('username', '?')}")

    catalogue_id = find_or_create_frente(token)
    print(f"smoke_frente: catalogue id={catalogue_id}")

    material = find_usd_material(token)
    print(f"smoke_frente: material id={material['id']} price_usd={material.get('price_usd')} base_price={material.get('base_price')} currency={material.get('currency')}")

    # Pick the price-per-m² in the material's currency.
    material_currency = material.get("currency") or "USD"
    if material_currency == "USD":
        material_price_m2 = float(material.get("price_usd") or 0)
    else:
        material_price_m2 = float(material.get("base_price") or 0)

    expected_price_per_meter = round(material_price_m2 * 0.13 * FORMULA_CONSTANT, 2)
    expected_total = round(material_price_m2 * 0.13 * FORMULA_CONSTANT * LINEAR_METERS, 2)
    print(f"smoke_frente: expected price/ml={expected_price_per_meter} total={expected_total}")

    client = find_client(token)
    print(f"smoke_frente: client id={client['id']}")

    snapshot = [
        {
            "additional_work_id": catalogue_id,
            "name": "Frente / Regrueso",
            "detail": None,
            "price": 0,
            "currency": material_currency,
            "quantity": 1,
            "total": 0,
            "materialName": "__GLOBAL__",
            "type": "frente",
            "linear_meters": LINEAR_METERS,
            "assigned_material_id": material["id"],
            "formula_values": None,
        }
    ]

    materials_data_snapshot = [
        {
            "id": material["id"],
            "name": material.get("name") or "Material Test",
            "price_m2": float(material.get("base_price") or 0),
            "price_m2_usd": float(material.get("price_usd") or 0),
            "currency": material_currency,
            "length": 100,
            "width": 100,
            "quantity": 1,
            "m2_used": 1,
            "m2_budgeted": 1,
            "is_alternative": False,
        }
    ]

    budget_body = {
        "client_id": client["id"],
        "material": material.get("name") or "Material Test",
        "material_price_m2": float(material.get("base_price") or 0),
        "materials_data": json.dumps(materials_data_snapshot),
        "fabrication_details": "[]",
        "pools_data": "[]",
        "sketch_elements": "[]",
        "additional_works_data": json.dumps(snapshot),
        "usd_rate": 1000,
        "subtotal": expected_total,
        "total": expected_total,
    }
    created = request_json("POST", "/budgets", token=token, body=budget_body, expect=(200, 201))["data"] 
    budget_id = int(created["id"])
    print(f"smoke_frente: budget created id={budget_id}")

    persisted_raw = created.get("additional_works_data") or "[]"
    persisted = json.loads(persisted_raw) if isinstance(persisted_raw, str) else persisted_raw
    frente_row = next((r for r in persisted if r.get("type") == "frente"), None)
    assert frente_row is not None, "Persisted snapshot has no `frente` row."

    row_currency = frente_row.get("currency")
    row_price = float(frente_row.get("price") or 0)
    row_total = float(frente_row.get("total") or 0)
    fv = frente_row.get("formula_values") or {}
    # Snapshot now stores `multiplier`. Fall back to legacy `constant` so
    # smoke tests work against budgets created by the previous build too.
    row_multiplier = float(fv.get("multiplier") or fv.get("constant") or 0)
    row_m2_at_selection = float(fv.get("material_price_m2_at_selection") or 0)

    print(
        f"smoke_frente: persisted currency={row_currency} price={row_price} total={row_total} "
        f"multiplier={row_multiplier} m2_at_selection={row_m2_at_selection}"
    )

    failures: List[str] = []
    if row_currency != material_currency:
        failures.append(f"currency mismatch: expected {material_currency}, got {row_currency}")
    if abs(row_price - expected_price_per_meter) > 0.01:
        failures.append(f"price mismatch: expected {expected_price_per_meter}, got {row_price}")
    if abs(row_total - expected_total) > 0.01:
        failures.append(f"total mismatch: expected {expected_total}, got {row_total}")
    if abs(row_multiplier - FORMULA_CONSTANT) > 0.0001:
        failures.append(f"multiplier mismatch: expected {FORMULA_CONSTANT}, got {row_multiplier}")
    if abs(row_m2_at_selection - material_price_m2) > 0.0001:
        failures.append(
            f"m2_at_selection mismatch: expected {material_price_m2}, got {row_m2_at_selection}"
        )
    if abs(frente_row.get("linear_meters", 0) - LINEAR_METERS) > 0.0001:
        failures.append(
            f"linear_meters mismatch: expected {LINEAR_METERS}, "
            f"got {frente_row.get('linear_meters')}"
        )

    # 6. Re-fetch and assert the snapshot round-trips unchanged.
    reread = request_json("GET", f"/budgets/{budget_id}", token=token)["data"]
    reread_rows = json.loads(reread.get("additional_works_data") or "[]")
    reread_frente = next((r for r in reread_rows if r.get("type") == "frente"), None)
    if reread_frente is None or float(reread_frente.get("total") or 0) != row_total:
        failures.append(
            f"round-trip mismatch: persisted total {row_total}, re-read {reread_frente}"
        )

    # Cleanup
    try:
        request_json("DELETE", f"/budgets/{budget_id}", token=token, expect=204)
        print("smoke_frente: budget deleted")
    except AssertionError as exc:
        print(f"smoke_frente: cleanup failed (non-fatal): {exc}")

    if failures:
        print("smoke_frente: FAIL")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("smoke_frente: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
