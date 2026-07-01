import smtplib
from email.message import EmailMessage

from app.core.settings import settings


def send_budget_email(to_email: str, pdf_bytes: bytes, budget_number: str, company_name: str = "AFAMAR") -> None:
    if not settings.smtp_host or not settings.smtp_from:
        raise ValueError("SMTP no configurado. Verificar SMTP_HOST y SMTP_FROM en .env")

    msg = EmailMessage()
    msg["Subject"] = f"Presupuesto {budget_number} - {company_name}"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(
        f"Hola,\n\n"
        f"Adjuntamos el presupuesto {budget_number}.\n\n"
        f"Quedamos a su disposición para cualquier consulta.\n\n"
        f"Saludos,\n{company_name}"
    )

    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=f"presupuesto_{budget_number}.pdf",
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        server.starttls()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)


def send_work_order_email(to_email: str, pdf_bytes: bytes, order_number: str, company_name: str = "AFAMAR") -> None:
    if not settings.smtp_host or not settings.smtp_from:
        raise ValueError("SMTP no configurado. Verificar SMTP_HOST y SMTP_FROM en .env")

    msg = EmailMessage()
    msg["Subject"] = f"Orden de Trabajo {order_number} - {company_name}"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(
        f"Hola,\n\n"
        f"Adjuntamos la orden de trabajo {order_number}.\n\n"
        f"Quedamos a su disposición para cualquier consulta.\n\n"
        f"Saludos,\n{company_name}"
    )

    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=f"orden_de_trabajo_{order_number}.pdf",
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        server.starttls()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
