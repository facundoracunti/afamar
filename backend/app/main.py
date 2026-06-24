import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.config import get_settings
from app.database import engine, Base
import app.models  # noqa: F401 — ensure all models are loaded for create_all
from app.routers import clientes, presupuestos, ordenes_trabajo, materiales, stock_piletas, reportes, configuracion, dashboard, mediciones, presupuestos_online, caja

settings = get_settings()

Base.metadata.create_all(bind=engine)
os.makedirs("uploads", exist_ok=True)

app = FastAPI(title=settings.APP_NAME, version=settings.VERSION)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads") if os.path.exists("uploads") else None

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

@app.get("/api/health")
def health():
    return {"status": "ok", "version": settings.VERSION}
