from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.presupuesto_online import PresupuestoOnline
from app.utils.numeracion import generar_numero_presupuesto


class PresupuestoOnlineRepository(BaseRepository[PresupuestoOnline]):
    def __init__(self, db: Session):
        super().__init__(PresupuestoOnline, db)

    def create_with_numero(self, **kwargs) -> PresupuestoOnline:
        p = PresupuestoOnline(**kwargs)
        p.numero = generar_numero_presupuesto(self.db)
        self.db.add(p)
        self.db.commit()
        self.db.refresh(p)
        return p
