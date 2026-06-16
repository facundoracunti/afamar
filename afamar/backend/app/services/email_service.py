import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import get_settings

def enviar_email(destinatario: str, asunto: str, cuerpo: str) -> dict:
    settings = get_settings()
    if not settings.SMTP_SERVER or not settings.SMTP_PORT:
        return {"error": "Email no configurado"}

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.SMTP_USER or "noreply@afamar.com"
        msg["To"] = destinatario
        msg["Subject"] = asunto
        msg.attach(MIMEText(cuerpo, "plain", "utf-8"))

        server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return {"message": "Email enviado correctamente"}
    except Exception as e:
        return {"error": str(e)}
