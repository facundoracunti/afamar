"""Public, no-auth endpoints.

These routes are intentionally OUTSIDE the `get_current_user` dependency so a
client opening an AFAMAR doc link from WhatsApp (or anywhere) can download /
view the PDF WITHOUT an admin login. Access is gated by a short-lived signed
token minted server-side (`GET /api/v1/{budgets,work-orders}/{id}/public-token`)
— see `app/services/public_pdf_tokens.py`.

Expired links answer 410 Gone with a friendly client-facing message; tampered
/ malformed tokens answer 400.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.services.budget import BudgetService
from app.services.pdf_helpers import prepare_budget_payload, prepare_work_order_payload
from app.services.pdf_html import build_budget_pdf_data, build_work_order_pdf_data, generate_budget_pdf, generate_work_order_pdf
from app.services.public_pdf_tokens import PublicTokenExpiredError, PublicTokenInvalidError, decode_public_pdf_token
from app.services.work_order import WorkOrderService
from app.utils.responses import error
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["Public"])

_EXPIRED_MESSAGE = "El enlace ha expirado. Solicite un nuevo presupuesto/orden a AFAMAR."
_INVALID_MESSAGE = "El enlace es inválido. Solicite un nuevo presupuesto/orden a AFAMAR."


def _resolve_token(token: str, expected_doc_type: str):
    """Validate `token` and return the target document id.

    Returns a FastAPI `Response` (the JSON error envelope) when the token is
    expired (410) or invalid (400, 404 for unknown resource). Returns the int
    document id on success.
    """
    try:
        payload = decode_public_pdf_token(token)
    except PublicTokenExpiredError:
        return error(_EXPIRED_MESSAGE, status_code=410)
    except PublicTokenInvalidError:
        return error(_INVALID_MESSAGE, status_code=400)
    if payload["typ"] != expected_doc_type:
        return error(_INVALID_MESSAGE, status_code=400)
    return int(payload["id"])


@router.get("/work-orders/pdf")
def public_work_order_pdf(token: str = Query(..., description="Signed public token"), db: Session = Depends(get_db)):
    resolved = _resolve_token(token, "work_order")
    if isinstance(resolved, Response):
        return resolved
    order_id = resolved
    service = WorkOrderService(db)
    order = service.get_by_id(order_id)
    if not order:
        return error(_INVALID_MESSAGE, status_code=404)
    try:
        order_data, client_dict, company, terms = prepare_work_order_payload(order, db)
        pdf_data = build_work_order_pdf_data(order_data, client_dict, company, terms, db=db)
        pdf_bytes = generate_work_order_pdf(pdf_data, logo_path=company.get("company_logo")).read()
    except Exception:
        logger.exception("Public PDF render failed for work_order %s", order_id)
        return error("Ocurrió un error al generar el PDF. Intente nuevamente más tarde.", status_code=500)
    return Response(
        pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="orden_de_trabajo_{order.number}.pdf"'},
    )


@router.get("/budgets/pdf")
def public_budget_pdf(token: str = Query(..., description="Signed public token"), db: Session = Depends(get_db)):
    resolved = _resolve_token(token, "budget")
    if isinstance(resolved, Response):
        return resolved
    budget_id = resolved
    service = BudgetService(db)
    budget = service.get_by_id(budget_id)
    if not budget:
        return error(_INVALID_MESSAGE, status_code=404)
    try:
        budget_data, client_dict, company, terms = prepare_budget_payload(budget, db)
        pdf_data = build_budget_pdf_data(budget_data, client_dict, company, terms, db=db)
        pdf_bytes = generate_budget_pdf(pdf_data, logo_path=company.get("company_logo")).read()
    except Exception:
        logger.exception("Public PDF render failed for budget %s", budget_id)
        return error("Ocurrió un error al generar el PDF. Intente nuevamente más tarde.", status_code=500)
    return Response(
        pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="presupuesto_{budget.number}.pdf"'},
    )