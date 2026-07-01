import logging

import requests

from app.core.settings import settings

logger = logging.getLogger(__name__)


def send_whatsapp(phone: str, message: str) -> dict:
    if not settings.whatsapp_api_url or not settings.whatsapp_api_key:
        logger.warning("WhatsApp not configured — skipping send")
        return {"error": "WhatsApp no configurado"}

    try:
        resp = requests.post(
            settings.whatsapp_api_url,
            json={
                "phone": phone,
                "message": message,
                "api_key": settings.whatsapp_api_key,
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.exception("WhatsApp send failed")
        return {"error": str(e)}


def build_online_budget_message(number: str, client_name: str, total_ars: float, total_usd: float | None = None) -> str:
    msg = (
        f"¡Hola {client_name}! 👋\n\n"
        f"Recibimos tu solicitud de presupuesto online *{number}* de AFAMAR.\n\n"
        f"💰 *Total ARS: ${total_ars:,.2f}*"
    )
    if total_usd:
        msg += f"\n💵 *Total USD: US${total_usd:,.2f}*"
    msg += (
        "\n\nNos pondremos en contacto a la brevedad.\n\n"
        "¡Saludos!\n"
        "Equipo AFAMAR"
    )
    return msg


def build_work_order_message(number: str, client_name: str, status: str, total: float, total_usd: float | None = None) -> str:
    status_labels = {
        "MEASUREMENT": "📏 Measurement",
        "WORKSHOP": "🔧 Workshop",
        "FINISHED": "✅ Finished",
        "DELIVERED": "🚚 Delivered",
        "CANCELLED": "❌ Cancelled",
    }
    label = status_labels.get(status, status)
    msg = (
        f"¡Hola {client_name}! 👋\n\n"
        f"Te informamos el estado de tu orden de trabajo *{number}* de AFAMAR.\n\n"
        f"📌 *Estado:* {label}\n"
        f"💰 *Total: ${total:,.2f}*"
    )
    if total_usd:
        msg += f"\n💵 *Total USD: US${total_usd:,.2f}*"
    msg += (
        "\n\nPodés consultarnos cualquier duda.\n\n"
        "¡Saludos!\n"
        "Equipo AFAMAR"
    )
    return msg


def build_budget_message(number: str, client_name: str, total: float, total_usd: float | None = None) -> str:
    msg = (
        f"¡Hola {client_name}! 👋\n\n"
        f"Te enviamos el presupuesto *{number}* de AFAMAR.\n\n"
        f"💰 *Total: ${total:,.2f}*"
    )
    if total_usd:
        msg += f"\n💵 *Total USD: US${total_usd:,.2f}*"
    msg += (
        "\n\nPodés consultarnos cualquier duda al respecto.\n\n"
        "¡Saludos!\n"
        "Equipo AFAMAR"
    )
    return msg
