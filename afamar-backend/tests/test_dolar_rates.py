"""Tests for the centralized dolarapi.com quote service + `/api/v1/dolar/rates`."""
from app.services.dolar import (
    DolarRatesError,
    DolarRatesService,
    compute_blue_mid,
)


def test_blue_mid_is_average_of_compra_and_venta():
    assert compute_blue_mid(1540, 1560) == 1550.0
    assert compute_blue_mid(1535.5, 1574.5) == 1555.0
    assert compute_blue_mid(0, 1560) == 780.0


def test_service_exposes_official_venta_and_blue_mid():
    def fake_fetcher(casa):
        if casa == "oficial":
            return {"venta": 1450.5, "compra": 1440.0}
        if casa == "blue":
            return {"compra": 1540.0, "venta": 1560.0}
        raise AssertionError(f"Unexpected casa: {casa}")

    rates = DolarRatesService(fetcher=fake_fetcher).get_rates()
    assert rates["official_sale_rate"] == 1450.50
    assert rates["blue_mid_rate"] == 1550.0
    assert "updated_at" in rates


def test_service_caches_within_ttl():
    calls = []

    def fake_fetcher(casa):
        calls.append(casa)
        return {"compra": 1, "venta": 3} if casa == "oficial" else {"compra": 1540.0, "venta": 1560.0}

    now = [0.0]
    ttl = 300
    service = DolarRatesService(fetcher=fake_fetcher, ttl=ttl, now=lambda: now[0])

    first = service.get_rates()
    assert len(calls) == 2  # oficial + blue

    now[0] += 100  # dentro del TTL → usa cache
    second = service.get_rates()
    assert len(calls) == 2
    assert first == second

    now[0] += 250  # supera el TTL → refetch
    third = service.get_rates()
    assert len(calls) == 4
    assert third == first


def test_force_refresh_bypasses_cache():
    responses = [{"venta": 1000.0}, {"venta": 2000.0}]

    def fake_fetcher(casa):
        if casa == "oficial":
            return {"venta": responses[0]["venta"]}
        return {"compra": responses[0]["venta"], "venta": responses[0]["venta"] + 10}

    service = DolarRatesService(fetcher=fake_fetcher)
    assert service.get_rates()["official_sale_rate"] == 1000.0

    responses[0]["venta"] = 2000.0
    service.force_refresh()
    assert service.get_rates()["official_sale_rate"] == 2000.0


def test_upstream_failure_raises_dolar_rates_error():
    def fake_fetcher(casa):
        raise RuntimeError("connection refused")

    service = DolarRatesService(fetcher=fake_fetcher)
    try:
        service.get_rates()
    except DolarRatesError as exc:
        assert "cotización" in str(exc)
    else:  # pragma: no cover — fail loud if no exception
        raise AssertionError("Expected DolarRatesError")


def test_endpoint_returns_both_rates(client, monkeypatch):
    from app.api.routers import dolar as dolar_router
    from app.services.dolar import compute_blue_mid

    monkeypatch.setattr(
        dolar_router,
        "dolar_rates_service",
        DolarRatesService(
            fetcher=lambda casa: (
                {"venta": 1450.0} if casa == "oficial" else {"compra": 1540.0, "venta": 1560.0}
            )
        ),
    )

    res = client.get("/api/v1/dolar/rates")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["official_sale_rate"] == 1450.0
    assert body["data"]["blue_mid_rate"] == compute_blue_mid(1540.0, 1560.0)


def test_endpoint_returns_502_when_upstream_fails(client, monkeypatch):
    from app.api.routers import dolar as dolar_router
    from app.services.dolar import DolarRatesService

    monkeypatch.setattr(
        dolar_router,
        "dolar_rates_service",
        DolarRatesService(fetcher=lambda casa: (_ for _ in ()).throw(RuntimeError("boom"))),
    )

    res = client.get("/api/v1/dolar/rates")
    assert res.status_code == 502
    body = res.json()
    assert body["success"] is False
    assert "cotización" in (body["error"] or "")


def test_endpoint_requires_auth(public_client):
    res = public_client.get("/api/v1/dolar/rates")
    assert res.status_code == 401