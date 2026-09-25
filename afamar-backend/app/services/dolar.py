"""Centralized currency-quote service backed by dolarapi.com.

AFAMAR uses two different USD rates depending on the document type:
  - `official_sale_rate` — Dólar Oficial Venta. Used by **presupuestos**.
  - `blue_mid_rate`      — Dólar Blue promedio `(compra + venta) / 2`. Used by
                            **órdenes de trabajo** y la conversión de cobros
                            (efectivo / dólar billete) registrados en ellas.

Both are exposed through `GET /api/v1/dolar/rates` so the web UI and the legacy
PDF generators consume the same source of truth. Rates are cached in-process
for `DOLAR_CACHE_TTL_SECONDS` to avoid hammering the upstream API on every form
load.
"""
from __future__ import annotations

import time
from typing import Callable

import requests

DOLAR_API_BASE = "https://dolarapi.com/v1/dolares"
DOLAR_CACHE_TTL_SECONDS = 300  # 5 minutes

# A `casa` is one of dolarapi.com's endpoints: "oficial", "blue", "tarjeta", ...
Fetcher = Callable[[str], dict]


def _default_fetcher(casa: str) -> dict:
    response = requests.get(f"{DOLAR_API_BASE}/{casa}", timeout=5)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise ValueError(f"dolarapi.com/{casa}: respuesta inválida")
    return data


def compute_blue_mid(compra: float, venta: float) -> float:
    """Dólar Blue promedio = (compra + venta) / 2, redondeado a 2 decimales."""
    return round((float(compra) + float(venta)) / 2, 2)


class DolarRatesError(RuntimeError):
    """Upstream dolarapi.com fetch failed; the caller decides how to surface it."""


class DolarRatesService:
    """Fetches + caches both rates. `fetcher`/`now` are test seams.

    `fetcher(casa)` replaces the real HTTP call and `now()` replaces the clock
    so unit tests can exercise the TTL cache without touching the network.
    """

    def __init__(
        self,
        fetcher: Fetcher | None = None,
        ttl: int = DOLAR_CACHE_TTL_SECONDS,
        now: Callable[[], float] | None = None,
    ) -> None:
        self._fetcher = fetcher or _default_fetcher
        self._ttl = ttl
        self._now = now or time.time
        self._cache: dict | None = None
        self._cached_at: float = 0.0

    def get_rates(self) -> dict:
        """Return `{official_sale_rate, blue_mid_rate, updated_at}` (cached)."""
        if self._cache is None or (self._now() - self._cached_at) >= self._ttl:
            self._cache = self._fetch_rates()
            self._cached_at = self._now()
        # Copy so callers can't mutate the internal cache entry.
        return dict(self._cache)

    def force_refresh(self) -> dict:
        """Re-fetch regardless of TTL (used by the manual refresh button)."""
        self._cache = self._fetch_rates()
        self._cached_at = self._now()
        return dict(self._cache)

    def clear_cache(self) -> None:
        self._cache = None
        self._cached_at = 0.0

    def _fetch_rates(self) -> dict:
        try:
            oficial = self._fetcher("oficial")
            blue = self._fetcher("blue")
        except Exception as exc:  # noqa: BLE001 — upstream failures share one error
            raise DolarRatesError(f"No se pudo obtener la cotización del dólar: {exc}") from exc
        return {
            "official_sale_rate": round(float(oficial.get("venta", 0) or 0), 2),
            "blue_mid_rate": compute_blue_mid(
                float(blue.get("compra", 0) or 0),
                float(blue.get("venta", 0) or 0),
            ),
            "updated_at": _iso_now(),
        }


def _iso_now() -> str:
    import datetime

    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


# Module-level singleton shared by the router. Callable dependents can get their
# own instance for state isolation (e.g. tests).
dolar_rates_service = DolarRatesService()