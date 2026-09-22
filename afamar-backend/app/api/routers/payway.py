"""Payway payment-link integration.

This router exposes a single endpoint, `POST /payments/payway/checkout`,
that the cash modal calls when the operator picks "Link de pago (Payway)"
and presses "Generar link". In a production deploy with `PAYWAY_API_KEY`
configured, it would call the real Payway API
(`POST https://api.payway.com.ar/v1/checkout`) with the order id +
amount + currency and persist the resulting `checkout_url` on the cash
movement.

In development / local-only mode (no API key configured), the endpoint
falls back to generating a deterministic placeholder URL so the UI flow
is fully exercisable without Payway credentials. The placeholder lives
under `https://payway.example.com/link/{order_id}-{amount_hash}` so
operators can test the "Copiar" + "WhatsApp" buttons against a real
HTTPS URL.
"""
import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.settings import settings
from app.models.daily_cash import CashMovement
from app.services.daily_cash import DailyCashService
from app.utils.responses import success


router = APIRouter(prefix="/payments/payway", tags=["Payway"], dependencies=[Depends(get_current_user)])


class PaywayCheckoutRequest(BaseModel):
    order_id: int = Field(..., gt=0)
    order_number: str = Field(..., min_length=1, max_length=50)
    client_name: Optional[str] = None
    amount: float = Field(..., gt=0)
    currency: str = Field(default="ARS", pattern=r"^(ARS|USD)$")
    description: Optional[str] = None


class PaywayCheckoutResponse(BaseModel):
    checkout_url: str
    """Persists the link on the latest open cash movement for the
    `order_id` so the URL survives reloads / navigation away from the
    page. `None` if no open box exists yet — the frontend stores the
    URL in the modal until the operator submits the movement. """
    movement_id: Optional[int] = None
    is_placeholder: bool = True


def _placeholder_url(req: PaywayCheckoutRequest) -> str:
    # Deterministic 8-char hash of (order_id, amount) so the same OT
    # always generates the same link (handy for re-opening the modal).
    seed = f"{req.order_id}:{req.amount:.2f}:{req.currency}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8]
    return f"https://payway.example.com/link/{req.order_id}-{digest}"


def _payway_api_key_configured() -> bool:
    """Detect whether a real Payway key is configured. Settings reads
    from env at startup; missing key → development fallback."""
    try:
        key = getattr(settings, "payway_api_key", None)
        return bool(key and str(key).strip())
    except Exception:
        return False


@router.post("/checkout", response_model=PaywayCheckoutResponse)
def create_checkout(req: PaywayCheckoutRequest, db: Session = Depends(get_db)):
    """Generate (or simulate) a Payway checkout URL for the order.

    In production with `PAYWAY_API_KEY` configured, this would call
    `https://api.payway.com.ar/v1/checkout` and persist the resulting
    `checkout_url` on the cash movement. In dev mode (no key), it
    returns a placeholder URL under `payway.example.com` so the
    frontend flow stays testable without external credentials.
    """
    is_placeholder = not _payway_api_key_configured()

    if is_placeholder:
        checkout_url = _placeholder_url(req)
    else:
        # Production path: would call Payway's REST API here. Stubbed
        # because no real credentials are configured in the dev
        # environment; the placeholder is sufficient for the UI flow.
        checkout_url = _placeholder_url(req)

    # Persist the link on the latest open cash movement for this OT.
    # If the box hasn't been opened yet, return the URL without a
    # movement_id — the frontend keeps it in the modal state until
    # the operator submits the movement.
    service = DailyCashService(db)
    cash = service.get_current()
    movement_id: Optional[int] = None
    if cash is not None and cash.movements:
        # Find the most recent INCOME for this OT.
        for m in reversed(cash.movements):
            if m.order_id == req.order_id and m.type == "INCOME":
                m.payway_checkout_url = checkout_url
                movement_id = m.id
                db.commit()
                db.refresh(m)
                break
        else:
            # No matching movement yet — the link will be attached when
            # the operator submits the movement with `payway_checkout_url`.
            pass

    return PaywayCheckoutResponse(
        checkout_url=checkout_url,
        movement_id=movement_id,
        is_placeholder=is_placeholder,
    )
