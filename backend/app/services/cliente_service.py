from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.cliente import ClienteRepository
from app.models.orden_trabajo import OrdenTrabajo
from app.services.exceptions import NotFoundError, ConflictError


class ClienteService:
    def __init__(self, db: Session):
        self.repo = ClienteRepository(db)

    def listar(self, search: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[dict]:
        from app.schemas.cliente import ClienteList

        clientes = self.repo.search(search, skip, limit)
        result = []
        for c in clientes:
            total_ordenes = (
                self.repo.db.query(OrdenTrabajo)
                .filter(OrdenTrabajo.cliente_id == c.id)
                .count()
            )
            ultima_orden = (
                self.repo.db.query(OrdenTrabajo.numero)
                .filter(OrdenTrabajo.cliente_id == c.id)
                .order_by(OrdenTrabajo.id.desc())
                .first()
            )
            result.append(
                ClienteList(
                    id=c.id,
                    nombre=c.nombre,
                    telefono=c.telefono,
                    email=c.email,
                    direccion=c.direccion,
                    observaciones=c.observaciones,
                    total_ordenes=total_ordenes,
                    ultima_orden=ultima_orden[0] if ultima_orden else None,
                    created_at=c.created_at,
                    updated_at=c.updated_at,
                )
            )
        return result

    def obtener(self, cliente_id: int) -> dict:
        data = self.repo.get_with_stats(cliente_id)
        if not data:
            raise NotFoundError("Cliente", cliente_id)
        return data

    def crear(self, nombre: str, telefono: Optional[str] = None,
              email: Optional[str] = None, direccion: Optional[str] = None,
              observaciones: Optional[str] = None) -> dict:
        if telefono:
            existente = self.repo.find_by_telefono(telefono)
            if existente:
                raise ConflictError(
                    f"Ya existe un cliente con el teléfono {telefono}: {existente.nombre}"
                )
        cliente = self.repo.create(
            nombre=nombre, telefono=telefono, email=email,
            direccion=direccion, observaciones=observaciones,
        )
        return {
            "id": cliente.id, "nombre": cliente.nombre,
            "telefono": cliente.telefono, "email": cliente.email,
            "direccion": cliente.direccion, "observaciones": cliente.observaciones,
            "created_at": cliente.created_at, "updated_at": cliente.updated_at,
        }

    def actualizar(self, cliente_id: int, data: dict) -> dict:
        cliente = self.repo.get(cliente_id)
        if not cliente:
            raise NotFoundError("Cliente", cliente_id)
        if data.get("telefono") and data["telefono"] != cliente.telefono:
            existente = self.repo.find_by_telefono(data["telefono"])
            if existente and existente.id != cliente_id:
                raise ConflictError(
                    f"Ya existe otro cliente con el teléfono {data['telefono']}: {existente.nombre}"
                )
        updated = self.repo.update(cliente_id, **data)
        if not updated:
            raise NotFoundError("Cliente", cliente_id)
        return {
            "id": updated.id, "nombre": updated.nombre,
            "telefono": updated.telefono, "email": updated.email,
            "direccion": updated.direccion, "observaciones": updated.observaciones,
            "created_at": updated.created_at, "updated_at": updated.updated_at,
        }

    def eliminar(self, cliente_id: int) -> None:
        if not self.repo.delete(cliente_id):
            raise NotFoundError("Cliente", cliente_id)
