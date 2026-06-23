from typing import Optional
from sqlalchemy.orm import Session
from app.repositories.caja import CajaDiariaRepository, MovimientoCajaRepository
from app.services.exceptions import NotFoundError
from datetime import date


class CajaService:
    def __init__(self, db: Session):
        self.caja_repo = CajaDiariaRepository(db)
        self.mov_repo = MovimientoCajaRepository(db)

    def obtener_o_crear(self, fecha: date) -> dict:
        caja = self.caja_repo.get_or_create(fecha)
        movimientos = self.mov_repo.get_by_caja(caja.id)
        return self._to_dict(caja, movimientos)

    def crear_movimiento(self, data: dict) -> dict:
        fecha = data.pop("fecha")
        caja = self.caja_repo.get_or_create(fecha)
        orden_total = data.get("orden_total")
        monto = data.get("monto", 0)
        if orden_total is not None and monto is not None:
            data["saldo_restante"] = orden_total - monto
        movimiento = self.mov_repo.create_and_recalcular(caja.id, data)
        caja = self.caja_repo.recalcular(caja.id)
        movimientos = self.mov_repo.get_by_caja(caja.id)
        return self._to_dict(caja, movimientos)

    def eliminar_movimiento(self, movimiento_id: int) -> dict:
        mov = self.mov_repo.get(movimiento_id)
        if not mov:
            raise NotFoundError("MovimientoCaja", movimiento_id)
        caja_id = mov.caja_id
        self.mov_repo.delete(movimiento_id)
        caja = self.caja_repo.recalcular(caja_id)
        movimientos = self.mov_repo.get_by_caja(caja.id)
        return self._to_dict(caja, movimientos)

    def actualizar_saldo_anterior(self, fecha: date, saldo_anterior: float) -> dict:
        caja = self.caja_repo.get_or_create(fecha)
        caja.saldo_anterior = saldo_anterior
        caja = self.caja_repo.recalcular(caja.id)
        movimientos = self.mov_repo.get_by_caja(caja.id)
        return self._to_dict(caja, movimientos)

    def cerrar_caja(self, fecha: date, observaciones: Optional[str] = None) -> dict:
        caja = self.caja_repo.get_or_create(fecha)
        caja = self.caja_repo.recalcular(caja.id)
        caja.cerrada = True
        caja.observaciones = observaciones
        self.caja_repo.db.commit()
        self.caja_repo.db.refresh(caja)
        movimientos = self.mov_repo.get_by_caja(caja.id)
        return self._to_dict(caja, movimientos)

    def obtener_historial(self) -> list:
        cajas = self.caja_repo.get_cerradas()
        result = []
        for caja in cajas:
            movimientos = self.mov_repo.get_by_caja(caja.id)
            result.append(self._to_dict(caja, movimientos))
        return result

    def _to_dict(self, caja, movimientos) -> dict:
        return {
            "id": caja.id,
            "fecha": caja.fecha,
            "saldo_anterior": caja.saldo_anterior,
            "total_ingresos": caja.total_ingresos,
            "total_salidas": caja.total_salidas,
            "suma": caja.suma,
            "saldo_actual": caja.saldo_actual,
            "efectivo_real": caja.efectivo_real,
            "cerrada": caja.cerrada,
            "observaciones": caja.observaciones,
            "created_at": caja.created_at,
            "updated_at": caja.updated_at,
            "movimientos": [
                {
                    "id": m.id,
                    "caja_id": m.caja_id,
                    "tipo": m.tipo,
                    "monto": m.monto,
                    "concepto": m.concepto,
                    "forma_pago": m.forma_pago,
                    "estado_carpeta": m.estado_carpeta,
                    "orden_id": m.orden_id,
                    "orden_numero": m.orden_numero,
                    "orden_total": m.orden_total,
                    "cliente_nombre": m.cliente_nombre,
                    "tipo_egreso": m.tipo_egreso,
                    "saldo_restante": m.saldo_restante,
                    "created_at": m.created_at,
                }
                for m in movimientos
            ],
        }
