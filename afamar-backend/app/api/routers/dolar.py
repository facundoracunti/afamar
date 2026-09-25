from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_current_user
from app.services.dolar import DolarRatesError, DolarRatesService, dolar_rates_service
from app.utils.responses import success

router = APIRouter(dependencies=[Depends(get_current_user)])


def get_dolar_rates_service() -> DolarRatesService:
    return dolar_rates_service


@router.get("/rates")
def get_rates(service: DolarRatesService = Depends(get_dolar_rates_service)):
    """Centralized USD quote for AFAMAR.

    Exposes both rates the app uses:
      - `official_sale_rate`: Dólar Oficial Venta (presupuestos).
      - `blue_mid_rate`:      Dólar Blue promedio (órdenes de trabajo / cobros).

    Cached in-process for `DOLAR_CACHE_TTL_SECONDS`. If the upstream is down,
    returns 502 with a friendly message instead of crashing — the frontend
    keeps the current rate on the form.
    """
    try:
        rates = service.get_rates()
    except DolarRatesError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return success(rates)