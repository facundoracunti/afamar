"""End-to-end smoke test for adicionales in budget.

1. Create a couple of adicionales in the catalogue.
2. Create a budget with those adicionales selected (adicionales_data).
3. Read the budget back and confirm the adicionales are in
   adicionales_data as a JSON snapshot.
4. Convert the budget to a work order; confirm the WO inherited the
   adicionales_data.
5. Update the WO; confirm we can also update the adicionales_data.
6. Cleanup.
"""
import json
import requests

BASE = "http://localhost:3095"
s = requests.Session()
r = s.post(f"{BASE}/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
s.headers["Authorization"] = f"Bearer {r.json()['data']['access_token']}"

# Get a client
r = s.get(f"{BASE}/api/v1/clients?limit=1")
client = r.json()['data'][0]

# Create 2 adicionales in the catalogue
ad1_payload = {"name": "SMOKE Pulido", "price": 1500, "currency": "ARS"}
ad2_payload = {"name": "SMOKE Engraving", "price": 50, "currency": "USD"}
r = s.post(f"{BASE}/api/v1/adicionales", json=ad1_payload)
assert r.status_code == 201, r.text
ad1 = r.json()['data']
r = s.post(f"{BASE}/api/v1/adicionales", json=ad2_payload)
assert r.status_code == 201, r.text
ad2 = r.json()['data']

# Build the adicionales_data snapshot the way the form would
adicionales_data = json.dumps([
    {
        "adicional_id": ad1['id'], "name": ad1['name'], "detail": ad1.get('detail'),
        "price": ad1['price'], "currency": "ARS", "quantity": 2, "total": 3000.0,
    },
    {
        "adicional_id": ad2['id'], "name": ad2['name'], "detail": ad2.get('detail'),
        "price": ad2['price'], "currency": "USD", "quantity": 1, "total": 50.0,
    },
])

# Create a budget with those adicionales
payload = {
    "client_id": client['id'],
    "delivery_address_id": None,
    "date": "2026-07-08",
    "status": "PENDING",
    "material": "GRIS MARA",
    "material_price_m2": 0,
    "materials_data": json.dumps([]),
    "fabrication_details": json.dumps([]),
    "pools_data": json.dumps([]),
    "adicionales_data": adicionales_data,
    "adicionales": [],
    "items": [],
    "sketch_elements": None,
    "currency": "ARS",
    "usd_rate": 1200,
    "subtotal": 3050.0,  # 3000 ARS + 50 USD (this is just for the API to accept)
    "transport": 0,
    "total": 3050.0,
    "subtotal_usd": 2.5,  # placeholder
    "total_usd": 2.5,
    "deposit_received": 0,
    "deposit_usd": 0,
    "balance_due": 3050.0,
    "balance_due_usd": 2.5,
    "balance_paid": False,
    "payment_method": None,
    "installments": 1,
    "priority": "NORMAL",
}
r = s.post(f"{BASE}/api/v1/budgets", json=payload)
print(f"POST budget: {r.status_code}")
assert r.status_code == 201, r.text
budget = r.json()['data']
budget_id = budget['id']
budget_number = budget['number']
print(f"  created budget {budget_number} (id={budget_id})")

# Read it back and confirm the snapshot
r = s.get(f"{BASE}/api/v1/budgets/{budget_id}")
loaded = r.json()['data']
print(f"  loaded adicionales_data: {loaded.get('adicionales_data')!r}")
assert loaded.get('adicionales_data') is not None
parsed_back = json.loads(loaded['adicionales_data'])
assert len(parsed_back) == 2
assert parsed_back[0]['name'] == 'SMOKE Pulido'
assert parsed_back[0]['quantity'] == 2
assert parsed_back[0]['total'] == 3000.0
assert parsed_back[1]['name'] == 'SMOKE Engraving'
assert parsed_back[1]['currency'] == 'USD'
print(f"  snapshot preserved: {len(parsed_back)} items, names = {[r['name'] for r in parsed_back]}")

# Approve the budget so we can convert to WO
r = s.put(f"{BASE}/api/v1/budgets/{budget_id}", json={"status": "APPROVED"})
assert r.status_code == 200
print("  budget APPROVED")

# Convert to WO
r = s.post(f"{BASE}/api/v1/work-orders/from-budget/{budget_id}")
print(f"POST work-orders/from-budget: {r.status_code}")
if r.status_code != 201:
    print(f"  body: {r.text[:500]}")
r.raise_for_status()
wo = r.json()['data']
wo_id = wo['id']
wo_number = wo['number']
print(f"  created WO {wo_number} (id={wo_id})")

# Confirm the WO inherited the snapshot
r = s.get(f"{BASE}/api/v1/work-orders/{wo_id}")
loaded_wo = r.json()['data']
print(f"  WO adicionales_data: {loaded_wo.get('adicionales_data')!r}")
assert loaded_wo.get('adicionales_data') is not None
parsed_wo = json.loads(loaded_wo['adicionales_data'])
assert len(parsed_wo) == 2
assert parsed_wo[0]['name'] == 'SMOKE Pulido'
assert parsed_wo[1]['name'] == 'SMOKE Engraving'
print(f"  WO snapshot preserved: {[r['name'] for r in parsed_wo]}")

# Update the WO with a new adicionales_data snapshot
new_snapshot = json.dumps([
    {
        "adicional_id": ad1['id'], "name": ad1['name'], "detail": None,
        "price": ad1['price'], "currency": "ARS", "quantity": 5, "total": 7500.0,
    },
])
r = s.put(f"{BASE}/api/v1/work-orders/{wo_id}", json={"adicionales_data": new_snapshot})
print(f"PUT work-orders: {r.status_code}")
assert r.status_code == 200
updated = r.json()['data']
parsed_updated = json.loads(updated['adicionales_data'])
assert len(parsed_updated) == 1
assert parsed_updated[0]['quantity'] == 5
print(f"  WO updated, qty={parsed_updated[0]['quantity']}")

# Cleanup
r = s.delete(f"{BASE}/api/v1/budgets/{budget_id}")
print(f"DELETE budget: {r.status_code}")
r = s.delete(f"{BASE}/api/v1/work-orders/{wo_id}")
print(f"DELETE work-order: {r.status_code}")
r = s.delete(f"{BASE}/api/v1/adicionales/{ad1['id']}")
r = s.delete(f"{BASE}/api/v1/adicionales/{ad2['id']}")
print(f"DELETE adicionales: {r.status_code}")

print("\n=== ALL CHECKS PASSED ===")
