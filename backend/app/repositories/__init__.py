from app.repositories.base import BaseRepository
from app.repositories.cliente import ClienteRepository
from app.repositories.presupuesto import PresupuestoRepository
from app.repositories.orden_trabajo import OrdenTrabajoRepository
from app.repositories.material import MaterialRepository
from app.repositories.stock_pileta import StockPiletaRepository, MovimientoPiletaRepository
from app.repositories.medicion import MedicionRepository
from app.repositories.presupuesto_online import PresupuestoOnlineRepository
from app.repositories.configuracion import ConfiguracionRepository

__all__ = [
    "BaseRepository",
    "ClienteRepository",
    "PresupuestoRepository",
    "OrdenTrabajoRepository",
    "MaterialRepository",
    "StockPiletaRepository",
    "MovimientoPiletaRepository",
    "MedicionRepository",
    "PresupuestoOnlineRepository",
    "ConfiguracionRepository",
]
