"""Signed public PDF tokens.

Mints and verifies the stateless bearer token used by the *public* PDF
endpoints (`GET /api/v1/public/{budgets,work-orders}/pdf?token=…`) so a
client can open a budget / work-order PDF from WhatsApp WITHOUT an admin
login.

Format: ``<base64url(payload)>.<base64url(hmac_sha256)>``

Payload JSON::

    {"typ": "work_order" | "budget", "id": <doc_id>, "exp": <unix_sec>}

Signature: HMAC-SHA256 over the payload base64url, keyed with
``settings.SECRET_KEY`` and domain-separated with a purpose prefix (so the
same secret that signs the JWT auth tokens cannot be reused to forge PDF
links). Expiry is configurable via ``PUBLIC_PDF_TOKEN_EXPIRE_DAYS``.
"""
import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

from app.core.settings import settings

_PURPOSE = b"afamar:public-pdf-token:1"
# Domain of doc kinds supported by the signed links. Keeps `typ` bounded so
# a corrupted token cannot address an arbitrary resource.
ALLOWED_DOC_TYPES = ("work_order", "budget")


class PublicTokenError(Exception):
    """Base class for signed-token failures (invalid / expired)."""


class PublicTokenInvalidError(PublicTokenError):
    """The token failed signature validation or has a malformed payload."""


class PublicTokenExpiredError(PublicTokenError):
    """The token signature is valid but its `exp` timestamp is in the past."""


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value.encode("ascii") + padding.encode("ascii"))


def _signing_key() -> bytes:
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), _PURPOSE, hashlib.sha256).digest()


def _sign(payload_b64: str) -> str:
    digest = hmac.new(_signing_key(), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return _b64url(digest)


def create_public_pdf_token(
    doc_type: str,
    doc_id: int,
    now: datetime | None = None,
    ttl_days: int | None = None,
) -> str:
    """Mint a signed token for the given document.

    `now` / `ttl_days` are test seams; production uses the current time and
    `settings.PUBLIC_PDF_TOKEN_EXPIRE_DAYS`.
    """
    if doc_type not in ALLOWED_DOC_TYPES:
        raise ValueError(f"Unsupported doc_type: {doc_type!r}")
    anchor = now or datetime.now(timezone.utc)
    ttl = ttl_days if ttl_days is not None else settings.PUBLIC_PDF_TOKEN_EXPIRE_DAYS
    expires_at = anchor + timedelta(days=ttl)
    payload = {
        "typ": doc_type,
        "id": int(doc_id),
        "exp": int(expires_at.timestamp()),
    }
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{payload_b64}.{_sign(payload_b64)}"


def decode_public_pdf_token(token: str, now: datetime | None = None) -> dict:
    """Validate `token` and return its payload dict.

    Raises `PublicTokenInvalidError` on malformed/tampered tokens and
    `PublicTokenExpiredError` when the `exp` timestamp is in the past.
    """
    if not token or "." not in token:
        raise PublicTokenInvalidError("Enlace inválido o incompleto")
    payload_b64, signature = token.rsplit(".", 1)
    if not _sign(payload_b64) == signature:
        raise PublicTokenInvalidError("Enlace inválido o firmado incorrectamente")
    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise PublicTokenInvalidError("Enlace malformado") from exc
    if not isinstance(payload, dict) or payload.get("typ") not in ALLOWED_DOC_TYPES:
        raise PublicTokenInvalidError("Enlace inválido")
    if not isinstance(payload.get("id"), int):
        raise PublicTokenInvalidError("Enlace inválido")
    exp = payload.get("exp")
    if not isinstance(exp, int):
        raise PublicTokenInvalidError("Enlace inválido")
    anchor = now or datetime.now(timezone.utc)
    if int(anchor.timestamp()) > exp:
        raise PublicTokenExpiredError(
            "El enlace ha expirado. Solicite un nuevo presupuesto/orden a AFAMAR."
        )
    return payload