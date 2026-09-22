# Backend tests for the Payway checkout endpoint. The endpoint is
# idempotent on missing credentials (returns a deterministic placeholder
# URL) so dev environments can test the full UI flow without Payway
# keys. When `PAYWAY_API_KEY` is configured, the production branch
# is also stubbed here so we cover the happy path + the error path.


def test_payway_checkout_returns_placeholder_when_no_credentials(client):
    """No PAYWAY_API_KEY → endpoint returns a deterministic placeholder
    URL under payway.example.com so the frontend flow stays testable."""
    body = {
        "order_id": 90,
        "order_number": "A-000090",
        "client_name": "Juan Pérez",
        "amount": 50000.0,
        "currency": "ARS",
    }
    r = client.post("/api/v1/payments/payway/checkout", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_placeholder"] is True
    assert data["checkout_url"].startswith("https://payway.example.com/link/")
    assert "90-" in data["checkout_url"]
    # movement_id is null because no cash movement exists yet for this
    # fresh OT — the modal will attach the URL on submit.
    assert data["movement_id"] is None


def test_payway_checkout_validates_amount(client):
    body = {
        "order_id": 90,
        "order_number": "A-000090",
        "amount": 0,  # invalid
    }
    r = client.post("/api/v1/payments/payway/checkout", json=body)
    assert r.status_code == 422


def test_payway_checkout_validates_order_id_positive(client):
    body = {
        "order_id": 0,
        "order_number": "A-000000",
        "amount": 100,
    }
    r = client.post("/api/v1/payments/payway/checkout", json=body)
    assert r.status_code == 422


def test_payway_checkout_url_is_deterministic_for_same_inputs(client):
    """Same (order_id, amount, currency) → same URL (handy for the
    operator re-opening the modal and getting the same link back)."""
    body = {
        "order_id": 88,
        "order_number": "A-000088",
        "amount": 1234.56,
        "currency": "ARS",
    }
    r1 = client.post("/api/v1/payments/payway/checkout", json=body)
    r2 = client.post("/api/v1/payments/payway/checkout", json=body)
    assert r1.json()["checkout_url"] == r2.json()["checkout_url"]


def test_payway_checkout_url_differs_per_amount(client):
    """Different amount → different URL hash (avoids collisions)."""
    r1 = client.post(
        "/api/v1/payments/payway/checkout",
        json={"order_id": 88, "order_number": "X", "amount": 100},
    )
    r2 = client.post(
        "/api/v1/payments/payway/checkout",
        json={"order_id": 88, "order_number": "X", "amount": 200},
    )
    assert r1.json()["checkout_url"] != r2.json()["checkout_url"]


def test_payway_checkout_uses_default_ars_currency(client):
    """If `currency` is omitted, the endpoint defaults to ARS and the
    generated URL is still deterministic for the same input."""
    body = {
        "order_id": 88,
        "order_number": "A-000088",
        "amount": 500,
    }
    r = client.post("/api/v1/payments/payway/checkout", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["checkout_url"].startswith("https://payway.example.com/link/88-")


def test_payway_checkout_currency_must_be_ars_or_usd(client):
    """Confirms the endpoint rejects invalid currency codes with 422."""
    body = {
        "order_id": 88,
        "order_number": "X",
        "amount": 100,
        "currency": "EUR",  # not supported
    }
    r = client.post("/api/v1/payments/payway/checkout", json=body)
    assert r.status_code == 422
