from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.caja import CajaDiaria, MovimientoCaja
from datetime import date


class CajaDiariaRepository(BaseRepository[CajaDiaria]):
    def __init__(self, db: Session):
        super().__init__(CajaDiaria, db)

    def get_by_fecha(self, fecha: date) -> Optional[CajaDiaria]:
        return self.db.query(CajaDiaria).filter(CajaDiaria.fecha == fecha).first()

    def get_or_create(self, fecha: date) -> CajaDiaria:
        caja = self.get_by_fecha(fecha)
        if not caja:
            caja = CajaDiaria(fecha=fecha)
            self.db.add(caja)
            self.db.commit()
            self.db.refresh(caja)
        return caja

    def recalcular(self, caja_id: int) -> CajaDiaria:
        caja = self.get(caja_id)
        if not caja:
            return caja

        movs = (
            self.db.query(MovimientoCaja)
            .filter(MovimientoCaja.caja_id == caja_id)
            .all()
        )

        total_ingresos = sum(m.monto for m in movs if m.tipo == "INGRESO")
        total_salidas = sum(m.monto for m in movs if m.tipo == "EGRESO")
        suma = (caja.saldo_anterior or 0) + total_ingresos
        saldo_actual = suma - total_salidas

        ingresos_efectivo = sum(
            m.monto for m in movs
            if m.tipo == "INGRESO" and m.forma_pago == "Efectivo"
        )
        total_tb = sum(
            m.monto for m in movs
            if m.tipo == "EGRESO" and m.tipo_egreso == "Transferencia Banco"
        )
        efectivo_real = (caja.saldo_anterior or 0) + ingresos_efectivo - (total_salidas - total_tb)

        caja.total_ingresos = total_ingresos
        caja.total_salidas = total_salidas
        caja.suma = suma
        caja.saldo_actual = saldo_actual
        caja.efectivo_real = efectivo_real

        self.db.commit()
        self.db.refresh(caja)
        return caja


class MovimientoCajaRepository(BaseRepository[MovimientoCaja]):
    def __init__(self, db: Session):
        super().__init__(MovimientoCaja, db)

    def get_by_caja(self, caja_id: int) -> List[MovimientoCaja]:
        return (
            self.db.query(MovimientoCaja)
            .filter(MovimientoCaja.caja_id == caja_id)
            .order_by(MovimientoCaja.created_at.asc())
            .all()
        )

    def create_and_recalcular(self, caja_id: int, data: dict) -> MovimientoCaja:
        movimiento = MovimientoCaja(caja_id=caja_id, **data)
        self.db.add(movimiento)
        self.db.commit()
        self.db.refresh(movimiento)
        return movimiento
