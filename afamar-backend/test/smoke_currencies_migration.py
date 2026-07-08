"""Verify the currencies migration works end-to-end after the FK/refresh fixes."""
import requests
import sys

BASE = "http://localhost:3095"
s = requests.Session()
r = s.post(f"{BASE}/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
s.headers["Authorization"] = f"Bearer {r.json()['data']['access_token']}"

# Cleanup any leftover test material
sys.path.insert(0, ".")
from app.db.database import SessionLocal
from app.models.material import Material

db = SessionLocal()
try:
    for m in db.query(Material).filter(Material.name.like("TEST CURRENCY%")).all():
        print(f"cleanup: deleting material id={m.id} name={m.name}")
        db.delete(m)
    db.commit()
finally:
    db.close()

# Test 1: GET materials — should return currency='ARS' (or 'USD' for any USD materials)
r = s.get(f"{BASE}/api/v1/materials?limit=10")
assert r.status_code == 200, r.text
mats = r.json()["data"]
print(f"\nmaterials ({len(mats)}):")
for m in mats[:3]:
    print(f"  {m['name']}: currency={m.get('currency')!r} base_price={m.get('base_price')} price_usd={m.get('price_usd')}")
assert all(m.get('currency') in ('ARS', 'USD') for m in mats), "Some materials missing currency code"
print("OK all materials have a currency code")

# Test 2: GET pool stock — should return currency='ARS' (no price_usd anymore)
r = s.get(f"{BASE}/api/v1/pool-stock?limit=3")
assert r.status_code == 200, r.text
pools = r.json()["data"]
print(f"\npool stock ({len(pools)}):")
for p in pools[:3]:
    print(f"  {p['brand']} {p['model']}: currency={p.get('currency')!r} price={p.get('price')} price_usd={p.get('price_usd')!r}")
assert all('price_usd' not in p for p in pools), "price_usd should be gone from pool_stock"
assert all(p.get('currency') in ('ARS', 'USD') for p in pools), "Some pools missing currency code"
print("OK all pool_stock rows have a currency code and no price_usd")

# Test 3: POST a USD material — should succeed and return currency='USD'
r = s.get(f"{BASE}/api/v1/materials/categories")
cat_id = r.json()["data"][0]["id"]

payload = {
    "name": "TEST USD MATERIAL 3",
    "category_id": cat_id,
    "color": "test",
    "base_price": 0,
    "price_usd": 99000,
    "currency": "USD",
    "stock_available": 1,
}
r = s.post(f"{BASE}/api/v1/materials", json=payload)
print(f"\nPOST USD material: status={r.status_code} body={r.text[:300]}")
assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
new_mat = r.json()["data"]
assert new_mat["currency"] == "USD", f"Expected currency=USD, got {new_mat['currency']!r}"
assert new_mat["price_usd"] == 99000
print(f"OK created material id={new_mat['id']} currency={new_mat['currency']!r} price_usd={new_mat['price_usd']}")

# Cleanup
s.delete(f"{BASE}/api/v1/materials/{new_mat['id']}")
print(f"OK cleaned up material {new_mat['id']}")

# Test 4: POST an ARS material — should succeed and return currency='ARS'
payload = {
    "name": "TEST ARS MATERIAL 3",
    "category_id": cat_id,
    "color": "test",
    "base_price": 99000,
    "price_usd": 0,
    "currency": "ARS",
    "stock_available": 1,
}
r = s.post(f"{BASE}/api/v1/materials", json=payload)
print(f"\nPOST ARS material: status={r.status_code} body={r.text[:300]}")
assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
new_mat = r.json()["data"]
assert new_mat["currency"] == "ARS", f"Expected currency=ARS, got {new_mat['currency']!r}"
print(f"OK created material id={new_mat['id']} currency={new_mat['currency']!r} base_price={new_mat['base_price']}")
s.delete(f"{BASE}/api/v1/materials/{new_mat['id']}")
print(f"OK cleaned up material {new_mat['id']}")

# Test 5: POST with unknown currency — should 422
payload["currency"] = "EUR"
r = s.post(f"{BASE}/api/v1/materials", json=payload)
print(f"\nPOST unknown currency: status={r.status_code} body={r.text[:300]}")
assert r.status_code == 422, f"Expected 422, got {r.status_code}"
assert "EUR" in r.text or "Moneda desconocida" in r.text
print("OK unknown currency returns 422")

print("\n=== ALL CHECKS PASSED ===")
