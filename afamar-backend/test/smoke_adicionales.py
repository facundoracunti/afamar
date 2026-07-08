"""Smoke test the adicionales CRUD end-to-end."""
import requests

BASE = "http://localhost:3095"
s = requests.Session()
r = s.post(f"{BASE}/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
s.headers["Authorization"] = f"Bearer {r.json()['data']['access_token']}"

# Test 1: list (should be empty)
r = s.get(f"{BASE}/api/v1/adicionales")
print(f"GET /adicionales: status={r.status_code} body={r.text[:200]}")
assert r.status_code == 200
assert r.json()["data"] == []

# Test 2: create ARS
payload = {
    "name": "Pulido de bordes",
    "detail": "Pulido fino en todos los bordes expuestos",
    "price": 15000.0,
    "currency": "ARS",
    "is_active": True,
    "sort_order": 1,
}
r = s.post(f"{BASE}/api/v1/adicionales", json=payload)
print(f"\nPOST ARS adicional: status={r.status_code} body={r.text[:200]}")
assert r.status_code == 201, r.text
ad1 = r.json()["data"]
assert ad1["currency"] == "ARS", f"expected ARS, got {ad1['currency']}"
assert ad1["price"] == 15000.0
assert ad1["name"] == "Pulido de bordes"
print(f"  created id={ad1['id']} currency={ad1['currency']} price={ad1['price']}")

# Test 3: create USD
payload["name"] = "Engraving"
payload["price"] = 50.0
payload["currency"] = "USD"
r = s.post(f"{BASE}/api/v1/adicionales", json=payload)
print(f"\nPOST USD adicional: status={r.status_code} body={r.text[:200]}")
assert r.status_code == 201, r.text
ad2 = r.json()["data"]
assert ad2["currency"] == "USD", f"expected USD, got {ad2['currency']}"
assert ad2["price"] == 50.0
print(f"  created id={ad2['id']} currency={ad2['currency']} price={ad2['price']}")

# Test 4: list (should have 2)
r = s.get(f"{BASE}/api/v1/adicionales")
items = r.json()["data"]
print(f"\nGET list: {len(items)} adicionales")
assert len(items) == 2
for a in items:
    print(f"  {a['name']}: currency={a['currency']} price={a['price']}")
assert all(a.get('currency') in ('ARS', 'USD') for a in items)

# Test 5: update
r = s.put(f"{BASE}/api/v1/adicionales/{ad1['id']}", json={"price": 18000.0})
print(f"\nPUT adicional: status={r.status_code}")
assert r.status_code == 200
assert r.json()["data"]["price"] == 18000.0
print(f"  updated price={r.json()['data']['price']}")

# Test 6: delete
r = s.delete(f"{BASE}/api/v1/adicionales/{ad1['id']}")
print(f"\nDELETE adicional: status={r.status_code}")
assert r.status_code == 204

# Test 7: list (should have 1)
r = s.get(f"{BASE}/api/v1/adicionales")
items = r.json()["data"]
assert len(items) == 1
print(f"\nGET list after delete: {len(items)} adicional")

# Cleanup
s.delete(f"{BASE}/api/v1/adicionales/{ad2['id']}")
r = s.get(f"{BASE}/api/v1/adicionales")
assert r.json()["data"] == []
print("\nOK — all checks passed")
