from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.material import MaterialRepository
from app.services.exceptions import NotFoundError


class MaterialService:
    def __init__(self, db: Session):
        self.repo = MaterialRepository(db)

    def listar(self, categoria=None, search=None, skip=0, limit=100) -> list:
        return self.repo.search(categoria, search, skip, limit)

    def obtener(self, material_id: int):
        material = self.repo.get(material_id)
        if not material:
            raise NotFoundError("Material", material_id)
        return material

    def crear(self, data: dict):
        material = self.repo.create(**data)
        if material.precio_m2 and material.precio_m2 > 0:
            self.repo.record_price_change(
                material.id, material.nombre, 0, material.precio_m2
            )
        return material

    def actualizar(self, material_id: int, data: dict):
        material = self.repo.get(material_id)
        if not material:
            raise NotFoundError("Material", material_id)
        old_precio = material.precio_m2
        for key, value in data.items():
            setattr(material, key, value)
        new_precio = data.get("precio_m2", old_precio)
        if (
            isinstance(new_precio, (int, float))
            and new_precio != old_precio
            and new_precio > 0
        ):
            self.repo.record_price_change(
                material_id, material.nombre, old_precio, new_precio
            )
        self.repo.db.commit()
        self.repo.db.refresh(material)
        return material

    def eliminar(self, material_id: int):
        if not self.repo.delete(material_id):
            raise NotFoundError("Material", material_id)

    def price_history(self, material_id: int):
        return self.repo.get_price_history(material_id)
