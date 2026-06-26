import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.config import get_settings
from app.database import engine, Base
import app.models  # noqa: F401 — ensure all models are loaded for create_all

settings = get_settings()

Base.metadata.create_all(bind=engine)
os.makedirs("uploads", exist_ok=True)

app = FastAPI(title=settings.APP_NAME, version=settings.VERSION)

# ─── Middleware chain (last added = outermost) ────────────────────────────
#
# Request flow:  CORS → TrustedHost → ProxyHeaders → route
#
# 1. CORSMiddleware (outermost):  handles preflight OPTIONS before anything.
# 2. TrustedHostMiddleware:       rejects unexpected Host headers.
# 3. ProxyHeadersMiddleware (innermost):  translates X-Forwarded-* into
#    request.url.scheme, request.client, etc. for the route handler.

# ── 3rd (innermost) ──────────────────────────────────────────────────────
app.add_middleware(
    ProxyHeadersMiddleware,
    trusted_hosts=["*"],  # trust ngrok IPs to send X-Forwarded-*
)

# ── 2nd ───────────────────────────────────────────────────────────────────
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "localhost",
        "127.0.0.1",
        "[::1]",
        "*.ngrok-free.dev",
        "*.ngrok.io",
        "afamar.com.ar",
        "www.afamar.com.ar",
    ],
)

# ── 1st (outermost) ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ──────────────────────────────────────────────────────────
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads") if os.path.exists("uploads") else None

# ── Routers ───────────────────────────────────────────────────────────────
from app.routers import (auth, dashboard, clientes, presupuestos,
                         ordenes_trabajo, materiales, stock_piletas,
                         reportes, configuracion, mediciones,
                         presupuestos_online, caja, trabajos_realizados)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(clientes.router, prefix="/api/clientes", tags=["Clientes"])
app.include_router(presupuestos.router, prefix="/api/presupuestos", tags=["Presupuestos"])
app.include_router(ordenes_trabajo.router, prefix="/api/ordenes-trabajo", tags=["Órdenes de Trabajo"])
app.include_router(materiales.router, prefix="/api/materiales", tags=["Materiales"])
app.include_router(stock_piletas.router, prefix="/api/stock-piletas", tags=["Stock de Piletas"])
app.include_router(reportes.router, prefix="/api/reportes", tags=["Reportes"])
app.include_router(configuracion.router, prefix="/api/configuracion", tags=["Configuración"])
app.include_router(mediciones.router, prefix="/api/mediciones", tags=["Mediciones"])
app.include_router(presupuestos_online.router, prefix="/api/presupuestos-online", tags=["Presupuestos Online"])
app.include_router(caja.router, prefix="/api/caja", tags=["Caja"])
app.include_router(trabajos_realizados.router, prefix="/api/trabajos-realizados", tags=["Trabajos Realizados"])


@app.on_event("startup")
def seed_admin_on_startup():
    """Idempotent admin seed — runs after the app is ready, not at module level."""
    from app.database import SessionLocal
    from app.models.user import User
    from app.services.auth_service import hash_password

    db = SessionLocal()
    try:
        if not db.query(User).first():
            db.add(User(
                username="admin",
                email="admin@afamar.com.ar",
                hashed_password=hash_password("admin123"),
                full_name="Administrador",
                is_admin=True,
                is_active=True,
            ))
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": settings.VERSION}
