from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.stock_pileta import StockPileta, MovimientoPileta


class StockPiletaRepository(BaseRepository[StockPileta]):
    def __init__(self, db: Session):
        super().__init__(StockPileta, db)

    def search(self, search: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[StockPileta]:
        query = self.db.query(self.model)
        if search:
            query = query.filter(
                StockPileta.marca.ilike(f"%{search}%")
                | StockPileta.modelo.ilike(f"%{search}%")
            )
        return query.offset(skip).limit(limit).all()


class MovimientoPiletaRepository(BaseRepository[MovimientoPileta]):
    def __init__(self, db: Session):
        super().__init__(MovimientoPileta, db)

    def get_by_pileta(self, pileta_id: int) -> List[MovimientoPileta]:
        return (
            self.db.query(MovimientoPileta)
            .filter(MovimientoPileta.pileta_id == pileta_id)
            .order_by(MovimientoPileta.id.desc())
            .all()
        )

    def create_and_update_stock(
        self, pileta_id: int, tipo: str, cantidad: int, descripcion: Optional[str] = None
    ) -> MovimientoPileta:
        pileta = self.db.query(StockPileta).filter(StockPileta.id == pileta_id).first()
        if not pileta:
            raise ValueError("Pileta no encontrada")

        movimiento = MovimientoPileta(
            pileta_id=pileta_id,
            tipo=tipo,
            cantidad=cantidad,
            descripcion=descripcion,
        )
        self.db.add(movimiento)

        if tipo == "Ingreso":
            pileta.cantidad = (pileta.cantidad or 0) + cantidad
        elif tipo == "Egreso":
            pileta.cantidad = (pileta.cantidad or 0) - cantidad

        self.db.commit()
        self.db.refresh(movimiento)
        return movimiento


def descontar_stock_piletas(db: Session, piletas: list, orden_numero: str) -> None:
    if not piletas:
        return
    for pt in piletas:
        if not isinstance(pt, dict):
            continue
        pid = pt.get("pileta_id")
        cant = pt.get("cantidad", 1)
        if not pid:
            continue
        pileta = db.query(StockPileta).filter(StockPileta.id == pid).first()
        if pileta:
            pileta.cantidad = max(0, (pileta.cantidad or 0) - cant)
            movimiento = MovimientoPileta(
                pileta_id=pid,
                tipo="Egreso",
                cantidad=cant,
                descripcion=f"SALIDA POR PRODUCCIÓN - Orden {orden_numero}",
            )
            db.add(movimiento)


def restaurar_stock_piletas(db: Session, piletas: list, orden_numero: str) -> None:
    if not piletas:
        return
    for pt in piletas:
        if not isinstance(pt, dict):
            continue
        pid = pt.get("pileta_id")
        cant = pt.get("cantidad", 1)
        if not pid:
            continue
        pileta = db.query(StockPileta).filter(StockPileta.id == pid).first()
        if pileta:
            pileta.cantidad = (pileta.cantidad or 0) + cant
            movimiento = MovimientoPileta(
                pileta_id=pid,
                tipo="Ingreso",
                cantidad=cant,
                descripcion=f"ENTRADA POR CANCELACIÓN - Orden {orden_numero}",
            )
            db.add(movimiento)
