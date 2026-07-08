"""End-to-end smoke test: budget with sketch -> convert to WO -> verify sketch survives."""
import json
import requests

BASE = "http://localhost:3095"
s = requests.Session()

# Login
r = s.post(f"{BASE}/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
assert r.status_code == 200, f"login failed: {r.text}"
token = r.json()["data"]["access_token"]
s.headers["Authorization"] = f"Bearer {token}"

# Find a client
r = s.get(f"{BASE}/api/v1/clients?limit=1")
clients = r.json()["data"]
client = clients[0]
print(f"client: {client['name']} (id={client['id']})")

# Create a budget with a sketch. The sketch is 2 line shapes + 1 rect.
sketch_elements = json.dumps([
    {"type": "line", "data": json.dumps({"x": 10, "y": 20, "points": [0, 0, 50, 50], "stroke": "#000", "strokeWidth": 2}), "order": 0},
    {"type": "rect", "data": json.dumps({"x": 100, "y": 100, "width": 200, "height": 150, "stroke": "#f00", "strokeWidth": 3, "fill": "transparent"}), "order": 1},
])

payload = {
    "client_id": client["id"],
    "delivery_address_id": None,
    "date": "2026-07-08",
    "status": "PENDING",
    "material": "GRIS MARA",
    "material_price_m2": 50000,
    "materials_data": json.dumps([]),
    "fabrication_details": json.dumps([]),
    "pools_data": json.dumps([]),
    "adicionales": [],
    "items": [],
    "sketch_elements": sketch_elements,
    "currency": "ARS",
    "usd_rate": 1000,
    "subtotal": 100000,
    "transport": 0,
    "total": 100000,
    "subtotal_usd": 100,
    "total_usd": 100,
    "deposit_received": 0,
    "deposit_usd": 0,
    "balance_due": 100000,
    "balance_due_usd": 100,
    "balance_paid": False,
    "payment_method": None,
    "installments": 1,
    "priority": "NORMAL",
}
r = s.post(f"{BASE}/api/v1/budgets", json=payload)
assert r.status_code == 201, f"create budget failed: {r.status_code} {r.text[:500]}"
budget = r.json()["data"]
budget_id = budget["id"]
budget_number = budget["number"]
print(f"OK created budget {budget_number} (id={budget_id})")

# Verify the sketch was stored
r = s.get(f"{BASE}/api/v1/budgets/{budget_id}")
budget_loaded = r.json()["data"]
print(f"  budget.sketch_elements = {budget_loaded.get('sketch_elements')!r}")
print(f"  budget has {len(budget_loaded.get('sketch_elements', []))} sketch elements")

# Approve the budget (status must be APPROVED for conversion)
r = s.put(f"{BASE}/api/v1/budgets/{budget_id}", json={"status": "APPROVED"})
assert r.status_code == 200, f"approve failed: {r.text[:300]}"
print("OK approved budget")

# Convert to work order
r = s.post(f"{BASE}/api/v1/work-orders/from-budget/{budget_id}")
assert r.status_code == 201, f"convert failed: {r.status_code} {r.text[:500]}"
wo = r.json()["data"]
wo_id = wo["id"]
wo_number = wo["number"]
print(f"OK created WO {wo_number} (id={wo_id})")

# Verify the sketch survived the conversion
r = s.get(f"{BASE}/api/v1/work-orders/{wo_id}")
wo_loaded = r.json()["data"]
wo_sketch = wo_loaded.get("sketch_elements")
print(f"  WO.sketch_elements = {wo_sketch!r}")
print(f"  WO.sketch_elements type: {type(wo_sketch).__name__}")

if wo_sketch is None:
    print("  FAIL: sketch is null")
    raise SystemExit(1)
if isinstance(wo_sketch, str):
    parsed = json.loads(wo_sketch)
    print(f"  WO.sketch_elements (parsed) has {len(parsed)} elements")
    if len(parsed) != 2:
        print(f"  FAIL: expected 2 elements, got {len(parsed)}")
        raise SystemExit(1)
    print(f"  elements: {[e.get('type') for e in parsed]}")
elif isinstance(wo_sketch, list):
    print(f"  WO.sketch_elements is a list with {len(wo_sketch)} elements")
    if len(wo_sketch) != 2:
        print(f"  FAIL: expected 2 elements, got {len(wo_sketch)}")
        raise SystemExit(1)
else:
    print(f"  FAIL: unexpected type {type(wo_sketch)}")
    raise SystemExit(1)

print("\n=== ALL CHECKS PASSED ===")
