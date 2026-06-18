import requests
from app.config import get_settings

def enviar_whatsapp(numero: str, mensaje: str) -> dict:
    settings = get_settings()
    if not settings.WHATSAPP_API_URL or not settings.WHATSAPP_API_KEY:
        return {"error": "WhatsApp no configurado"}
    
    try:
        response = requests.post(
            settings.WHATSAPP_API_URL,
            json={
                "phone": numero,
                "message": mensaje,
                "api_key": settings.WHATSAPP_API_KEY
            },
            timeout=10
        )
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def generar_mensaje_presupuesto(numero: str, cliente: str, total: float) -> str:
    return (
        f"¡Hola {cliente}! 👋\n\n"
        f"Te enviamos el presupuesto {numero} por un total de ${total:.2f}.\n\n"
        f"Podés consultar y descargar el PDF desde nuestro sistema.\n\n"
        f"Quedamos a tu disposición.\n"
        f"AFAMAR Mármoles & Granitos"
    )
