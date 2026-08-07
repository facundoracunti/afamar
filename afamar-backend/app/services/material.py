from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ValidationError
from app.models.material import Material, MaterialCategory, MaterialColor, MaterialThickness
from app.models.price_history import PriceHistory
from app.repositories.material import ColorRepository, MaterialCategoryRepository, MaterialRepository, PriceHistoryRepository, ThicknessRepository
from app.utils.currency import resolve_currency_id


class MaterialService:
    def __init__(self, db: Session):
        self.repo = MaterialRepository(db)
        self.color_repo = ColorRepository(db)
        self.thickness_repo = ThicknessRepository(db)
        self.category_repo = MaterialCategoryRepository(db)
        self.price_history_repo = PriceHistoryRepository(db)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Material]:
        return self.repo.get_all(skip, limit)

    def get_by_id(self, material_id: int) -> Optional[Material]:
        return self.repo.get_by_id(material_id)

    def get_by_category(self, category_id: int) -> List[Material]:
        return self.repo.get_by_category(category_id)

    def create(self, data: dict) -> Material:
        # Translate the wire-format currency code into the FK the ORM
        # expects. The Material ORM model has no `currency` column
        # anymore — only `currency_id`.
        if "currency" in data:
            data["currency_id"] = resolve_currency_id(self.repo.db, data.pop("currency"))
        price = data.get("base_price", 0)
        material = self.repo.create(data)
        if price > 0:
            self.price_history_repo.create({
                "material_id": material.id,
                "material_name": material.name,
                "price_m2": price,
            })
        self.repo.db.commit()
        self.repo.db.refresh(material)
        return material

    def update(self, material_id: int, data: dict) -> Optional[Material]:
        material = self.repo.get_by_id(material_id)
        if not material:
            return None
        if "currency" in data:
            data["currency_id"] = resolve_currency_id(self.repo.db, data.pop("currency"))
        # Explicit `color_id: null` clears the color. The repository skips
        # None values generically, so resolve it here against the loaded row.
        if "color_id" in data and data["color_id"] is None:
            material.color_id = None
            del data["color_id"]
        old_price = material.base_price
        result = self.repo.update(material, data)
        if "base_price" in data and data["base_price"] != old_price:
            self.price_history_repo.create({
                "material_id": material.id,
                "material_name": material.name,
                "price_m2": data["base_price"],
            })
        self.repo.db.commit()
        self.repo.db.refresh(result)
        return result

    def delete(self, material_id: int) -> bool:
        material = self.repo.get_by_id(material_id)
        if not material:
            return False
        self.repo.delete(material)
        self.repo.db.commit()
        return True

    def get_price_history(self, material_id: int) -> List[PriceHistory]:
        return self.price_history_repo.get_by_material(material_id)

    def list_colors(self) -> List[MaterialColor]:
        return self.color_repo.get_all()

    def create_color(self, data: dict) -> MaterialColor:
        color = self.color_repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(color)
        return color

    def update_color(self, color_id: int, data: dict) -> Optional[MaterialColor]:
        color = self.color_repo.get_by_id(color_id)
        if not color:
            return None
        result = self.color_repo.update(color, data)
        self.repo.db.commit()
        self.repo.db.refresh(result)
        return result

    def delete_color(self, color_id: int) -> bool:
        color = self.color_repo.get_by_id(color_id)
        if not color:
            return False
        in_use = self.repo.db.query(Material).filter(Material.color_id == color_id).count()
        if in_use:
            raise ConflictError("Color en uso por materiales")
        self.color_repo.delete(color)
        self.repo.db.commit()
        return True

    def list_thicknesses(self) -> List[MaterialThickness]:
        return self.thickness_repo.get_all()

    def create_thickness(self, data: dict) -> MaterialThickness:
        thickness = self.thickness_repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(thickness)
        return thickness

    def delete_thickness(self, thickness_id: int) -> bool:
        thickness = self.thickness_repo.get_by_id(thickness_id)
        if not thickness:
            return False
        self.thickness_repo.delete(thickness)
        self.repo.db.commit()
        return True

    def list_categories(self) -> List[MaterialCategory]:
        return self.category_repo.get_all()

    def create_category(self, name: str) -> MaterialCategory:
        cat = self.category_repo.create(name)
        self.repo.db.commit()
        self.repo.db.refresh(cat)
        return cat

    def get_category(self, category_id: int) -> Optional[MaterialCategory]:
        return self.category_repo.get_by_id(category_id)

    def update_category(self, category_id: int, name: str) -> Optional[MaterialCategory]:
        cat = self.category_repo.get_by_id(category_id)
        if not cat:
            return None
        cat.name = name
        self.repo.db.commit()
        self.repo.db.refresh(cat)
        return cat

    def delete_category(self, category_id: int) -> bool:
        cat = self.category_repo.get_by_id(category_id)
        if not cat:
            return False
        self.category_repo.delete(cat)
        self.repo.db.commit()
        return True
