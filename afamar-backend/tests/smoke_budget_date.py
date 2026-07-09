"""Smoke test: date round-trip on a budget."""
import json
import requests
from datetime import date, datetime

BASE = "http://localhost:3095"
s = requests.Session()
r = s.post(f"{BASE}/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
token = r.json()["data"]["access_token"]
s.headers["Authorization"] = f"Bearer {token}"

# Get a client
r = s.get(f"{BASE}/api/v1/clients?limit=1")
client = r.json()["data"][0]

# What does the JS Date look like right now? We can't know exactly the user's
# local time, but we can verify the wire format end-to-end.
# Send several candidate dates and see what the API round-trips them to.
print(f"Server's Python `date.today()`: {date.today()}")
print(f"Server's Python `datetime.now()`: {datetime.now()}")
print()

for candidate in ["2026-07-08", "2026-07-07", "2026-07-09"]:
    payload = {
        "client_id": client["id"],
        "delivery_address_id": None,
        "date": candidate,
        "status": "PENDING",
        "material": "GRIS MARA",
        "material_price_m2": 50000,
        "materials_data": json.dumps([]),
        "fabrication_details": json.dumps([]),
        "pools_data": json.dumps([]),
        "additional_works": [],
        "items": [],
        "sketch_elements": None,
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
    assert r.status_code == 201, r.text
    budget = r.json()["data"]
    budget_id = budget["id"]

    r = s.get(f"{BASE}/api/v1/budgets/{budget_id}")
    loaded = r.json()["data"]
    print(f"sent date={candidate!r}  ->  response date={loaded.get('date')!r}  (slice[0:10]={str(loaded.get('date'))[:10]})")
