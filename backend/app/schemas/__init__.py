from app.schemas.cliente import ClienteBase, ClienteCreate, ClienteUpdate, Cliente, ClienteList, ClienteResumen
from app.schemas.presupuesto import (
    FabricacionDetalle, PresupuestoBase, PresupuestoCreate,
    PresupuestoUpdate, Presupuesto, PresupuestoItemSchema, PresupuestoAdicionalSchema,
)
from app.schemas.orden_trabajo import OrdenTrabajoBase, OrdenTrabajoCreate, OrdenTrabajoUpdate, OrdenTrabajo
from app.schemas.material import MaterialBase, MaterialCreate, MaterialUpdate, Material, PriceHistorySchema
from app.schemas.stock_pileta import (
    StockPiletaBase, StockPiletaCreate, StockPiletaUpdate, StockPileta,
    MovimientoPiletaBase, MovimientoPiletaCreate, MovimientoPileta,
)
from app.schemas.medicion import MedicionBase, MedicionCreate, MedicionUpdate, Medicion
from app.schemas.presupuesto_online import (
    PresupuestoOnlineItem, PresupuestoOnlineBase, PresupuestoOnlineCreate,
    PresupuestoOnlineUpdate, PresupuestoOnline,
)
from app.schemas.configuracion import ConfiguracionBase, ConfiguracionCreate, ConfiguracionUpdate, Configuracion
from app.schemas.dashboard import DashboardData, PresupuestoResumen, OrdenResumen, PiletaResumen
